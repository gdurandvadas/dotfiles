import { tool } from "@opencode-ai/plugin";
import {
  advancePhase,
  closeTask,
  createTask,
  deleteTask,
  formatCreateResult,
  formatDuration,
  formatStatusReport,
  formatTaskBranchName,
  listTasks,
  parseChangeType,
  readStatus,
  recordTaskEvidence,
  resolveTask,
  setTaskContract,
  setTaskBranch,
  setupTaskBranch,
  type AuditVerdict,
  type TaskPhase,
  type ChangeRadius,
  type EvidenceResult,
  type TaskRisk,
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
          const elapsed = manifest.metrics ? ` · ${formatDuration(manifest.metrics.total_ms)}` : "";
          return `${manifest.id} — ${manifest.title} [${manifest.status}, ${manifest.current_phase}]${elapsed}`;
        })
        .join("\n");
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const contract = tool({
  description: "Upgrade or set the typed task contract. Ready contracts gate implementation.",
  args: {
    id: tool.schema.string(),
    status: tool.schema.enum(["draft", "ready"]),
    risk: tool.schema.enum(["low", "medium", "high"]),
    change_radius: tool.schema.array(tool.schema.enum(["local", "component", "service", "system", "operational"])),
    allowed_paths: tool.schema.array(tool.schema.string()),
    forbidden_paths: tool.schema.array(tool.schema.string()),
    acceptance_criteria: tool.schema.array(tool.schema.string()),
    required_evidence: tool.schema.array(tool.schema.object({
      id: tool.schema.string(), kind: tool.schema.string(), command: tool.schema.string(), proves: tool.schema.string(),
    })),
  },
  async execute(args, context) {
    try {
      const id = resolveTask(context.directory, args.id);
      setTaskContract(context.directory, id, {
        status: args.status, risk: args.risk as TaskRisk,
        change_radius: args.change_radius as ChangeRadius[], allowed_paths: args.allowed_paths,
        forbidden_paths: args.forbidden_paths, acceptance_criteria: args.acceptance_criteria,
        required_evidence: args.required_evidence,
      });
      return formatStatusReport(readStatus(context.directory, id));
    } catch (error) { return `Error: ${error instanceof Error ? error.message : String(error)}`; }
  },
});

export const evidence = tool({
  description: "Record the result of one command declared by the task contract.",
  args: {
    id: tool.schema.string(), requirement_id: tool.schema.string(), command: tool.schema.string(),
    result: tool.schema.enum(["pass", "fail", "not_run"]), artifact: tool.schema.string().optional(), note: tool.schema.string(),
  },
  async execute(args, context) {
    try {
      const id = resolveTask(context.directory, args.id);
      recordTaskEvidence(context.directory, id, {
        requirement_id: args.requirement_id, command: args.command,
        result: args.result as EvidenceResult, artifact: args.artifact, note: args.note,
      });
      return formatStatusReport(readStatus(context.directory, id));
    } catch (error) { return `Error: ${error instanceof Error ? error.message : String(error)}`; }
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
