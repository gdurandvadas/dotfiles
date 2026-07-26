import { tool } from "@opencode-ai/plugin";
import {
  closeProject,
  createProject,
  dispatchProjectTask,
  formatProjectReport,
  inspectProjectItem,
  listProjects,
  markProjectTaskVerified,
  mergeProjectTask,
  readProjectStatus,
  recordProjectDecision,
  requeueProjectTask,
  resolveProject,
  setProjectPlan,
  summarizeProject,
  updateEvidenceRequirement,
  updateProjectTask,
  verifyProjectMilestone,
  verifyProjectTaskRequirement,
  type EvidenceRequirement,
  type ProjectManifest,
  type ProjectMilestone,
  type ProjectTask,
} from "../lib/project";
import { startTrace } from "../lib/project-telemetry";

function compact(directory: string, value: unknown): unknown {
  if (value && typeof value === "object" && "schema_version" in value) {
    return summarizeProject(directory, value as ProjectManifest);
  }
  if (value && typeof value === "object" && "manifest" in value) {
    const result = value as { manifest: ProjectManifest } & Record<string, unknown>;
    return { ...result, manifest: summarizeProject(directory, result.manifest) };
  }
  return value;
}

function output(directory: string, callback: () => unknown): string {
  try {
    return JSON.stringify(compact(directory, callback()), null, 2);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function mutation(
  context: { agent: string; directory: string },
  callback: () => unknown,
): string {
  if (context.agent !== "orchestrate") {
    return "Error: Only orchestrate may mutate project state.";
  }
  return output(context.directory, callback);
}

const requirement = tool.schema.object({
  id: tool.schema.string(),
  level: tool.schema.enum(["task", "milestone"]),
  command: tool.schema.array(tool.schema.string()),
  proves: tool.schema.string(),
  covers: tool.schema.array(tool.schema.string()),
  timeout_ms: tool.schema.number().optional(),
});

const projectTask = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  status: tool.schema.enum(["ready", "running", "verified", "merged", "blocked"]).optional(),
  depends_on: tool.schema.array(tool.schema.string()),
  allowed_paths: tool.schema.array(tool.schema.string()),
  forbidden_paths: tool.schema.array(tool.schema.string()),
  discovery_paths: tool.schema.array(tool.schema.string()),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  required_evidence: tool.schema.array(requirement),
});

const projectMilestone = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  status: tool.schema.enum(["pending", "active", "verifying", "verified", "blocked"]).optional(),
  depends_on: tool.schema.array(tool.schema.string()),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  required_evidence: tool.schema.array(requirement),
  tasks: tool.schema.array(projectTask),
});

export const create = tool({
  description: "Create a schema-v3 project and its integration branch.",
  args: { name: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () => createProject(context.directory, args.name));
  },
});

export const status = tool({
  description: "Return compact milestone progress, active work, and the next automatic action.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    return output(context.directory, () =>
      readProjectStatus(context.directory, resolveProject(context.directory, args.id))
    );
  },
});

export const inspect = tool({
  description: "Read one complete milestone or task contract when compact status is insufficient.",
  args: {
    id: tool.schema.string(),
    milestone_id: tool.schema.string(),
    task_id: tool.schema.string().optional(),
  },
  async execute(args, context) {
    return output(context.directory, () =>
      inspectProjectItem(
        context.directory,
        resolveProject(context.directory, args.id),
        args.milestone_id,
        args.task_id,
      )
    );
  },
});

export const list = tool({
  description: "List local projects using compact status reports.",
  args: {},
  async execute(_args, context) {
    return output(context.directory, () => listProjects(context.directory));
  },
});

export const plan = tool({
  description: "Set the approved milestone plan and its small implementation tasks.",
  args: {
    id: tool.schema.string(),
    milestones: tool.schema.array(projectMilestone),
  },
  async execute(args, context) {
    return mutation(context, () =>
      setProjectPlan(
        context.directory,
        resolveProject(context.directory, args.id),
        args.milestones as ProjectMilestone[],
      )
    );
  },
});

export const dispatch = tool({
  description: "Create a collision-free worktree for one ready task.",
  args: { id: tool.schema.string(), task_id: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () =>
      dispatchProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
      )
    );
  },
});

export const verify_task = tool({
  description: "Run and record one exact task evidence requirement.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
    requirement_id: tool.schema.string(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      verifyProjectTaskRequirement(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
        args.requirement_id,
      )
    );
  },
});

export const verify_task_done = tool({
  description: "Validate task scope and require all fresh task evidence.",
  args: { id: tool.schema.string(), task_id: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () =>
      markProjectTaskVerified(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
      )
    );
  },
});

export const merge = tool({
  description: "Merge one verified task without interactive commit signing.",
  args: { id: tool.schema.string(), task_id: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () =>
      mergeProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
      )
    );
  },
});

export const requeue = tool({
  description: "Return clean, unintegrated task work to ready using the next branch attempt.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
    rationale: tool.schema.string(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      requeueProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
        args.rationale,
      )
    );
  },
});

export const update_task = tool({
  description: "Add or correct an unmerged task contract without invoking reconciliation.",
  args: {
    id: tool.schema.string(),
    milestone_id: tool.schema.string(),
    task: projectTask,
    rationale: tool.schema.string(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      updateProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.milestone_id,
        args.task as ProjectTask,
        args.rationale,
      )
    );
  },
});

export const update_evidence = tool({
  description: "Correct one task or milestone command/timeout without replacing its owner.",
  args: {
    id: tool.schema.string(),
    owner_type: tool.schema.enum(["task", "milestone"]),
    owner_id: tool.schema.string(),
    requirement,
    rationale: tool.schema.string(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      updateEvidenceRequirement(
        context.directory,
        resolveProject(context.directory, args.id),
        args.owner_type,
        args.owner_id,
        args.requirement as EvidenceRequirement,
        args.rationale,
      )
    );
  },
});

export const verify_milestone = tool({
  description: "Run every milestone gate at integration HEAD and advance on complete success.",
  args: { id: tool.schema.string(), milestone_id: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () =>
      verifyProjectMilestone(
        context.directory,
        resolveProject(context.directory, args.id),
        args.milestone_id,
      )
    );
  },
});

export const decide = tool({
  description: "Record a material user or architecture decision, not routine operations.",
  args: {
    id: tool.schema.string(),
    summary: tool.schema.string(),
    rationale: tool.schema.string(),
    milestone_id: tool.schema.string().optional(),
    task_id: tool.schema.string().optional(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      recordProjectDecision(
        context.directory,
        resolveProject(context.directory, args.id),
        args.summary,
        args.rationale,
        args.milestone_id,
        args.task_id,
      )
    );
  },
});

export const close = tool({
  description: "Close a project after every milestone has passed its gates.",
  args: { id: tool.schema.string(), note: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () =>
      closeProject(
        context.directory,
        resolveProject(context.directory, args.id),
        args.note,
      )
    );
  },
});

export const report = tool({
  description: "Return a short human-readable progress report.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    try {
      return formatProjectReport(
        readProjectStatus(context.directory, resolveProject(context.directory, args.id)),
      );
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const trace = tool({
  description: "Bind this agent session to project telemetry without changing project state.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string().optional(),
  },
  async execute(args, context) {
    return output(context.directory, () =>
      startTrace({
        project_id: resolveProject(context.directory, args.id),
        session_id: context.sessionID,
        agent: context.agent,
        directory: context.directory,
        task_id: args.task_id,
      })
    );
  },
});
