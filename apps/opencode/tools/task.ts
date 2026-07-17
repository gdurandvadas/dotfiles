import { tool } from "@opencode-ai/plugin";
import {
  advancePhase,
  closeTask,
  createTask,
  deleteTask,
  formatCreateResult,
  formatStatusReport,
  formatTaskBranchName,
  listTasks,
  parseChangeType,
  readStatus,
  resolveTask,
  setTaskBranch,
  setupTaskBranch,
  type AuditVerdict,
  type TaskPhase,
} from "../lib/task";

export const create = tool({
  description:
    "Create a new task with required change type and branch checkout. Prefer /task-new.",
  args: {
    description: tool.schema.string().describe("Short description used for title and slug"),
    change_type: tool.schema
      .enum(["feat", "fix", "doc", "chore", "refactor", "perf"])
      .describe("Branch type prefix"),
    new_branch: tool.schema
      .boolean()
      .describe("Create a new branch from the default branch (true) or check out existing (false)"),
  },
  async execute(args, context) {
    try {
      const changeType = parseChangeType(args.change_type);
      const result = createTask(context.directory, args.description);
      const branch = formatTaskBranchName(changeType, result.manifest.id);
      try {
        const branchNote = setupTaskBranch(context.directory, branch, args.new_branch);
        setTaskBranch(context.directory, result.manifest.id, {
          branch,
          checkedOut: true,
          note: branchNote,
        });
        result.manifest.branch = branch;
        result.manifest.branch_checked_out = true;
        return formatCreateResult(result, { branchNote });
      } catch (error) {
        deleteTask(context.directory, result.manifest.id);
        throw error;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const status = tool({
  description: "Read task manifest, doc presence, branch HEAD check, and suggested next phase agent.",
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
  description:
    "Advance task phase. implement/audit advances require HEAD on the task branch.",
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
    "Resolve an audit verdict. A pass validates decisions.md and closes the task; a fail returns it to implement. Pass requires HEAD on the task branch.",
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
