import type { Plugin } from "@opencode-ai/plugin";
import {
  assertCommitAllowed,
  checkoutTaskBranch,
  createTask,
  deleteTask,
  formatCreateResult,
  formatTaskBranchName,
  parseTaskNewArgs,
  resolveTask,
  setTaskBranch,
  setupTaskBranch,
} from "../lib/task";

async function toast(
  ctx: { client: { tui: { showToast: (input: unknown) => Promise<unknown> } } },
  title: string,
  message: string,
  variant: "info" | "success" | "error",
): Promise<void> {
  try {
    await ctx.client.tui.showToast({
      body: { title, message, variant },
    });
  } catch {
    // Toast is best-effort when TUI is unavailable.
  }
}

function bashCommand(args: unknown): string | null {
  if (!args || typeof args !== "object") {
    return null;
  }
  const record = args as Record<string, unknown>;
  for (const key of ["command", "cmd", "script"]) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}

const TaskPlugin: Plugin = async (ctx) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") {
        return;
      }
      const command = bashCommand(output.args) ?? bashCommand(input);
      if (!command) {
        return;
      }
      assertCommitAllowed(ctx.directory, command);
    },

    "command.execute.before": async (input, output) => {
      const cmd = input.command;
      if (cmd !== "task-new" && cmd !== "task-run") {
        return;
      }

      try {
        if (cmd === "task-new") {
          const args = parseTaskNewArgs(input.arguments ?? "");
          if (!args.description) {
            output.parts.length = 0;
            output.parts.push({
              type: "text",
              text: [
                "Error: provide a short description and --change-type, e.g.",
                "/task-new auth migration --change-type=feat",
                '/task-new --name="auth migration" --change-type=feat --new-branch=true',
              ].join("\n"),
            });
            return;
          }

          const result = createTask(ctx.directory, args.description);
          const branch = formatTaskBranchName(args.changeType, result.manifest.id);

          try {
            const branchNote = setupTaskBranch(ctx.directory, branch, args.newBranch);
            setTaskBranch(ctx.directory, result.manifest.id, {
              branch,
              checkedOut: true,
              note: branchNote,
            });
            result.manifest.branch = branch;
            result.manifest.branch_checked_out = true;

            const message = formatCreateResult(result, { branchNote });
            await toast(ctx, "Task created", result.manifest.id, "success");

            output.parts.length = 0;
            output.parts.push({ type: "text", text: message });
          } catch (error) {
            deleteTask(ctx.directory, result.manifest.id);
            throw error;
          }
          return;
        }

        const idArg = (input.arguments ?? "").trim().split(/\s+/)[0] ?? "";
        if (cmd === "task-run") {
          if (!idArg) {
            return;
          }

          const resolved = resolveTask(ctx.directory, idArg);
          const branchNote = checkoutTaskBranch(ctx.directory, resolved);
          await toast(ctx, "Task ready", `${resolved} · ${branchNote}`, "info");
          return;
        }

      } catch (error) {
        output.parts.length = 0;
        const message = error instanceof Error ? error.message : String(error);
        await toast(ctx, cmd, message, "error");
        output.parts.push({ type: "text", text: `Error: ${message}` });
      }
    },
  };
};

export default TaskPlugin;
