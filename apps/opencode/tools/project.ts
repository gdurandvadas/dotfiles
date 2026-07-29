import { tool } from "@opencode-ai/plugin";
import {
  completeProjectTask,
  createGateRepair,
  createProject,
  dispatchProjectTask,
  escalateProjectTask,
  listProjects,
  readProjectStatus,
  readProjectTaskContext,
  recordProjectDecision,
  resolveProject,
  resolveProjectPreflight,
  setProjectPlan,
  verifyProjectNext,
  type EvidenceRequirement,
  type ProjectMilestoneInput,
  type ProjectTaskInput,
} from "../lib/project";

function output(callback: () => unknown): string {
  return JSON.stringify(callback(), null, 2);
}

function mutation(
  context: { agent: string },
  callback: () => unknown,
): string {
  if (context.agent !== "orchestrate") {
    throw new Error("Only orchestrate may mutate project state");
  }
  return output(callback);
}

const requirement = tool.schema.object({
  id: tool.schema.string(),
  level: tool.schema.enum(["preflight", "task", "milestone"]),
  command: tool.schema.array(tool.schema.string()),
  proves: tool.schema.string(),
  timeout_ms: tool.schema.number().optional(),
});

const taskContract = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  kind: tool.schema.enum(["normal", "gate-repair"]),
  implementation_tier: tool.schema.enum(["s", "m", "l"]),
  tier_rationale: tool.schema.string(),
  depends_on: tool.schema.array(tool.schema.string()),
  allowed_paths: tool.schema.array(tool.schema.string()),
  excluded_paths: tool.schema.array(tool.schema.string()).optional(),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  required_evidence: tool.schema.array(requirement),
});

const milestone = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  depends_on: tool.schema.array(tool.schema.string()),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  required_evidence: tool.schema.array(requirement),
  tasks: tool.schema.array(taskContract),
});

export const create = tool({
  description: "Create a new schema-v4 project and integration branch.",
  args: { name: tool.schema.string() },
  async execute(args, context) {
    return mutation(context, () => createProject(context.directory, args.name));
  },
});

export const status = tool({
  description:
    "Return project progress, including live evidence purpose, sequence, elapsed time, recent output, and the authoritative next action.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    return output(() =>
      readProjectStatus(context.directory, resolveProject(context.directory, args.id))
    );
  },
});

export const list = tool({
  description: "List schema-v4 projects; earlier project records are ignored.",
  args: {},
  async execute(_args, context) {
    return output(() => listProjects(context.directory));
  },
});

export const plan = tool({
  description:
    "Store an explicitly approved schema-v4 plan, including exact repository-defined evidence.",
  args: {
    id: tool.schema.string(),
    preflight: tool.schema.array(requirement),
    milestones: tool.schema.array(milestone),
  },
  async execute(args, context) {
    return mutation(context, () =>
      setProjectPlan(
        context.directory,
        resolveProject(context.directory, args.id),
        args.preflight as EvidenceRequirement[],
        args.milestones as ProjectMilestoneInput[],
      )
    );
  },
});

export const dispatch = tool({
  description:
    "Create a task worktree and return the selected implementation agent plus compact handle.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
  },
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

export const task_context = tool({
  description:
    "Fetch the authoritative contract for a dispatched task without copying it through prompts.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
  },
  async execute(args, context) {
    return output(() =>
      readProjectTaskContext(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
        context.agent,
      )
    );
  },
});

export const escalate_task = tool({
  description:
    "Escalate a running task upward to a larger implementation tier in the same worktree.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
    implementation_tier: tool.schema.enum(["m", "l"]),
    rationale: tool.schema.string(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      escalateProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
        args.implementation_tier,
        args.rationale,
      )
    );
  },
});

export const complete_task = tool({
  description:
    "Start or poll task evidence without blocking; return user-presentable live progress, enforce scope, and merge after every check passes.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
    poll_token: tool.schema.string().optional(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      completeProjectTask(
        context.directory,
        resolveProject(context.directory, args.id),
        args.task_id,
      )
    );
  },
});

export const verify_next = tool({
  description:
    "Start or poll one background preflight or milestone gate and return user-presentable live progress, prioritizing the last failure.",
  args: {
    id: tool.schema.string(),
    poll_token: tool.schema.string().optional(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      verifyProjectNext(
        context.directory,
        resolveProject(context.directory, args.id),
      )
    );
  },
});

export const resolve_preflight = tool({
  description:
    "Record the user's explicit baseline-repair or approved-exception choice after preflight fails.",
  args: {
    id: tool.schema.string(),
    action: tool.schema.enum(["repair", "exception"]),
    rationale: tool.schema.string(),
    repair: taskContract.optional(),
  },
  async execute(args, context) {
    return mutation(context, () =>
      resolveProjectPreflight(
        context.directory,
        resolveProject(context.directory, args.id),
        args.action,
        args.rationale,
        args.repair as ProjectTaskInput | undefined,
      )
    );
  },
});

export const repair_gate = tool({
  description:
    "After diagnosis, create or update the single cohesive repair for a failed milestone gate.",
  args: {
    id: tool.schema.string(),
    milestone_id: tool.schema.string(),
    diagnosis: tool.schema.string(),
    repair: taskContract,
  },
  async execute(args, context) {
    return mutation(context, () =>
      createGateRepair(
        context.directory,
        resolveProject(context.directory, args.id),
        args.milestone_id,
        args.repair as ProjectTaskInput,
        args.diagnosis,
      )
    );
  },
});

export const decide = tool({
  description: "Record a material user-approved project decision.",
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
