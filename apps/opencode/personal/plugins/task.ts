import type { Plugin } from "@opencode-ai/plugin";
import {
  createTask,
  formatCreateResult,
  formatStatusReport,
  readStatus,
  resolveTask,
} from "../lib/task";

const TaskPlugin: Plugin = async (ctx) => {
  return {
    "command.execute.before": async (input, output) => {
      const cmd = input.command;
      if (cmd !== "task-start" && cmd !== "task-continue") {
        return;
      }

      output.parts.length = 0;

      try {
        if (cmd === "task-start") {
          const description = (input.arguments ?? "").trim();
          if (!description) {
            output.parts.push({
              type: "text",
              text: "Error: provide a short description, e.g. /task-start auth migration",
            });
            return;
          }

          const result = createTask(ctx.directory, description);
          const message = formatCreateResult(result);

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

          output.parts.push({ type: "text", text: message });
          return;
        }

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
        const message = error instanceof Error ? error.message : String(error);
        output.parts.push({ type: "text", text: `Error: ${message}` });
      }
    },
  };
};

export default TaskPlugin;
