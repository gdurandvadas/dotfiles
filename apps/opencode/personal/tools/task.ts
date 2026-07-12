import { tool } from "@opencode-ai/plugin";
import {
  advancePhase,
  closeTask,
  createTask,
  formatCreateResult,
  formatStatusReport,
  listTasks,
  readStatus,
  resolveTask,
  type AuditVerdict,
  type TaskPhase,
} from "../lib/task";

export const create = tool({
  description: "Create a new task: allocate ID, create docs/tasks folder, write task.json.",
  args: {
    description: tool.schema.string().describe("Short description used for title and slug"),
  },
  async execute(args, context) {
    try {
      const result = createTask(context.directory, args.description);
      return formatCreateResult(result);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const status = tool({
  description: "Read task manifest, doc presence, and suggested next phase agent.",
  args: {
    id: tool.schema.string().describe("Task ID or numeric prefix (e.g. 0007 or 0007-auth-migration)"),
  },
  async execute(args, context) {
    try {
      const resolved = resolveTask(context.directory, args.id);
      return formatStatusReport(readStatus(context.directory, resolved));
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const list = tool({
  description: "List all tasks with current phase and status.",
  args: {},
  async execute(_args, context) {
    try {
      const reports = listTasks(context.directory);
      if (reports.length === 0) {
        return "No tasks found.";
      }
      return reports
        .map((report) => {
          const { manifest } = report;
          return `${manifest.id} — ${manifest.title} [${manifest.status}, ${manifest.current_phase}]`;
        })
        .join("\n");
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const advance = tool({
  description: "Advance task phase: append phase_log, update current_phase and updated_at.",
  args: {
    id: tool.schema.string().describe("Task ID or numeric prefix"),
    phase: tool.schema
      .enum(["design", "implement", "audit"])
      .describe("Target phase"),
    note: tool.schema.string().describe("Reason for the phase transition"),
  },
  async execute(args, context) {
    try {
      const resolved = resolveTask(context.directory, args.id);
      const manifest = advancePhase(context.directory, resolved, args.phase as TaskPhase, args.note);
      return formatStatusReport(readStatus(context.directory, manifest.id));
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const close = tool({
  description:
    "Resolve an audit verdict. A pass validates decisions.md and closes the task; a fail returns it to implement.",
  args: {
    id: tool.schema.string().describe("Task ID or numeric prefix"),
    verdict: tool.schema.enum(["pass", "fail"]).describe("Audit result"),
    note: tool.schema.string().describe("Evidence-backed audit conclusion"),
    foundational_blockers: tool.schema
      .number()
      .describe("Number of unresolved foundational blockers"),
  },
  async execute(args, context) {
    try {
      const resolved = resolveTask(context.directory, args.id);
      const manifest = closeTask(context.directory, resolved, {
        verdict: args.verdict as AuditVerdict,
        note: args.note,
        foundationalBlockers: args.foundational_blockers,
      });
      return formatStatusReport(readStatus(context.directory, manifest.id));
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
