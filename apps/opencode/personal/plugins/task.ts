import type { Plugin } from "@opencode-ai/plugin";
import type { BunShell } from "@opencode-ai/plugin/shell";
import {
  createTask,
  formatCreateResult,
  formatStatusReport,
  formatTaskBranchName,
  parseChangeType,
  parseIsNewBranch,
  parseTaskNewArgs,
  readStatus,
  resolveTask,
  setTaskBranch,
} from "../lib/task";

interface PendingBranchSetup {
  taskId: string;
}

const pendingBranchSetup = new Map<string, PendingBranchSetup>();

async function branchExists($: BunShell, branch: string): Promise<boolean> {
  const result = await $`git rev-parse --verify ${branch}`.quiet().nothrow();
  return result.exitCode === 0;
}

async function resolveDefaultBranch($: BunShell): Promise<string> {
  const originHead = await $`git symbolic-ref refs/remotes/origin/HEAD`.quiet().nothrow();
  if (originHead.exitCode === 0) {
    const ref = originHead.text().trim();
    const match = ref.match(/^refs\/remotes\/origin\/(.+)$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  for (const candidate of ["main", "master"]) {
    if (await branchExists($, candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not determine default branch.");
}

async function assertGitRepo($: BunShell): Promise<void> {
  const inRepo = await $`git rev-parse --is-inside-work-tree`.quiet().nothrow();
  if (inRepo.exitCode !== 0) {
    throw new Error("Not a git repository.");
  }
}

async function createBranchFromDefault($: BunShell, branch: string): Promise<string> {
  await assertGitRepo($);

  if (await branchExists($, branch)) {
    throw new Error(`Branch ${branch} already exists. Choose Existing branch instead.`);
  }

  const base = await resolveDefaultBranch($);
  await $`git switch ${base}`;
  await $`git switch -c ${branch}`;
  return `Created branch ${branch} from ${base}.`;
}

async function checkoutExistingBranch($: BunShell, branch: string): Promise<string> {
  await assertGitRepo($);

  if (!(await branchExists($, branch))) {
    throw new Error(`Branch ${branch} does not exist.`);
  }

  await $`git switch ${branch}`;
  return `Checked out ${branch}.`;
}

const TaskPlugin: Plugin = async (ctx) => {
  return {
    event: async ({ event }) => {
      if (event.type !== "question.replied" && event.type !== "question.rejected") {
        return;
      }

      const sessionID = event.properties.sessionID;
      const pending = pendingBranchSetup.get(sessionID);
      if (!pending) {
        return;
      }

      pendingBranchSetup.delete(sessionID);

      if (event.type === "question.rejected") {
        try {
          await ctx.client.tui.showToast({
            body: {
              title: pending.taskId,
              message: "Branch setup skipped",
              variant: "info",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }
        return;
      }

      const answers = event.properties.answers;
      const branchChoice = answers[0]?.[0];
      const changeTypeRaw = answers[1]?.[0];

      if (!branchChoice || !changeTypeRaw) {
        try {
          await ctx.client.tui.showToast({
            body: {
              title: pending.taskId,
              message: "Branch setup incomplete",
              variant: "error",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }
        return;
      }

      let branch: string;
      try {
        const changeType = parseChangeType(changeTypeRaw);
        branch = formatTaskBranchName(changeType, pending.taskId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        try {
          await ctx.client.tui.showToast({
            body: {
              title: pending.taskId,
              message,
              variant: "error",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }
        return;
      }

      try {
        const isNewBranch = parseIsNewBranch(branchChoice);
        const message = isNewBranch
          ? await createBranchFromDefault(ctx.$, branch)
          : await checkoutExistingBranch(ctx.$, branch);

        setTaskBranch(ctx.directory, pending.taskId, {
          branch,
          checkedOut: true,
          note: message,
        });

        try {
          await ctx.client.tui.showToast({
            body: {
              title: pending.taskId,
              message,
              variant: "success",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setTaskBranch(ctx.directory, pending.taskId, {
          branch,
          checkedOut: false,
          note: `branch setup failed: ${message}`,
        });
        try {
          await ctx.client.tui.showToast({
            body: {
              title: pending.taskId,
              message,
              variant: "error",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }
      }
    },

    "command.execute.before": async (input, output) => {
      const cmd = input.command;
      if (cmd !== "task-new" && cmd !== "task-continue") {
        return;
      }

      try {
        if (cmd === "task-new") {
          const { description } = parseTaskNewArgs(input.arguments ?? "");
          if (!description) {
            output.parts.length = 0;
            output.parts.push({
              type: "text",
              text: "Error: provide a short description, e.g. /task-new auth migration",
            });
            return;
          }

          const result = createTask(ctx.directory, description);
          pendingBranchSetup.set(input.sessionID, { taskId: result.manifest.id });

          const message = formatCreateResult(result, { branchPrompt: true });

          try {
            await ctx.client.tui.showToast({
              body: {
                title: "Task created",
                message: result.manifest.id,
                variant: "success",
              },
            });
          } catch {
            // Toast is best-effort when TUI is unavailable.
          }

          // Prepend (not replace) so the command template's instructions to
          // call the question tool still reach the model.
          output.parts.unshift({ type: "text", text: message });
          return;
        }

        output.parts.length = 0;

        const idArg = (input.arguments ?? "").trim().split(/\s+/)[0] ?? "";
        if (!idArg) {
          output.parts.push({
            type: "text",
            text: "Error: provide a task ID, e.g. /task-continue 0007-auth-migration",
          });
          return;
        }

        const resolved = resolveTask(ctx.directory, idArg);
        const report = readStatus(ctx.directory, resolved);
        const message = formatStatusReport(report);

        try {
          await ctx.client.tui.showToast({
            body: {
              title: report.manifest.id,
              message: `${report.manifest.status} · ${report.manifest.current_phase}`,
              variant: "info",
            },
          });
        } catch {
          // Toast is best-effort when TUI is unavailable.
        }

        output.parts.push({ type: "text", text: message });
      } catch (error) {
        output.parts.length = 0;
        const message = error instanceof Error ? error.message : String(error);
        output.parts.push({ type: "text", text: `Error: ${message}` });
      }
    },
  };
};

export default TaskPlugin;
