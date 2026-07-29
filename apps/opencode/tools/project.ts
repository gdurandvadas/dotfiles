import { tool } from "@opencode-ai/plugin";
import {
  createProject,
  listProjects,
  readProjectStatus,
  readProjectTaskContext,
  reportProject,
  resolveProject,
  setProjectPlan,
  startProjectTasks,
  validateProject,
  type ProjectPlanInput,
  type ProjectReportInput,
} from "../lib/project";

function render(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function requireProject(context: { agent: string }): void {
  if (context.agent !== "project") {
    throw new Error("Only the project primary agent may mutate Project state");
  }
}

const validation = tool.schema.object({
  id: tool.schema.string(),
  command: tool.schema.array(tool.schema.string()),
  proves: tool.schema.string(),
  timeout_ms: tool.schema.number().optional(),
});

const task = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  implementation_tier: tool.schema.enum(["s", "m", "l"]),
  tier_rationale: tool.schema.string(),
  depends_on: tool.schema.array(tool.schema.string()),
  expected_surfaces: tool.schema.array(tool.schema.string()),
  focused_checks: tool.schema.array(validation),
  parallel_group: tool.schema.string().optional(),
});

const milestone = tool.schema.object({
  id: tool.schema.string(),
  title: tool.schema.string(),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  tasks: tool.schema.array(task),
  validation: tool.schema.array(validation),
});

const objective = tool.schema.object({
  outcome: tool.schema.string(),
  acceptance_criteria: tool.schema.array(tool.schema.string()),
  non_goals: tool.schema.array(tool.schema.string()),
  guardrails: tool.schema.array(tool.schema.string()),
});

export const open = tool({
  description:
    "List schema-v5 projects, create a design record, or resolve an existing project.",
  args: {
    action: tool.schema.enum(["list", "create", "resolve"]),
    name_or_id: tool.schema.string().optional(),
  },
  async execute(args, context) {
    if (args.action === "list") return render(listProjects(context.directory));
    if (!args.name_or_id) throw new Error(`${args.action} requires name_or_id`);
    if (args.action === "resolve") {
      const id = resolveProject(context.directory, args.name_or_id);
      return render(readProjectStatus(context.directory, id));
    }
    requireProject(context);
    return render(createProject(context.directory, args.name_or_id));
  },
});

export const plan = tool({
  description:
    "Store a draft plan and create its Project branch/worktree, approve that plan, adapt tasks inside the active milestone, or request approval for a material milestone revision.",
  args: {
    id: tool.schema.string(),
    objective,
    milestones: tool.schema.array(milestone),
    rationale: tool.schema.string().optional(),
    approved: tool.schema.boolean().optional(),
  },
  async execute(args, context) {
    requireProject(context);
    const id = resolveProject(context.directory, args.id);
    return render(setProjectPlan(context.directory, id, args as ProjectPlanInput));
  },
});

export const status = tool({
  description: "Return compact Project state and its deterministic next action.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    const id = resolveProject(context.directory, args.id);
    return render(readProjectStatus(context.directory, id));
  },
});

export const next = tool({
  description:
    "Start or reclaim the next task in the visible Project checkout and return its handle.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    requireProject(context);
    const id = resolveProject(context.directory, args.id);
    return render(startProjectTasks(context.directory, id));
  },
});

export const context = tool({
  description:
    "Return the authoritative Objective, milestone, task, evidence, and assigned worktree.",
  args: {
    id: tool.schema.string(),
    task_id: tool.schema.string(),
  },
  async execute(args, context) {
    const id = resolveProject(context.directory, args.id);
    return render(
      readProjectTaskContext(
        context.directory,
        id,
        args.task_id,
        context.agent,
      ),
    );
  },
});

export const report = tool({
  description:
    "Record an implementation outcome, research, scope review, tier escalation, user answer, focused checks, observed clean worktree HEAD, or composition result.",
  args: {
    id: tool.schema.string(),
    kind: tool.schema.enum([
      "implemented",
      "tier_mismatch",
      "research_needed",
      "research_completed",
      "scope_review",
      "needs_user",
      "user_answer",
      "baseline_assessment",
    ]),
    task_id: tool.schema.string().optional(),
    rationale: tool.schema.string().optional(),
    summary: tool.schema.string().optional(),
    question: tool.schema.string().optional(),
    answer: tool.schema.string().optional(),
    revision: tool.schema.string().optional(),
    focused_checks: tool.schema.array(tool.schema.object({
      requirement_id: tool.schema.string(),
      result: tool.schema.enum(["pass", "fail"]),
      command: tool.schema.array(tool.schema.string()),
      duration_ms: tool.schema.number(),
      diagnostic: tool.schema.string().optional(),
    })).optional(),
    assessment: tool.schema.object({
      necessary: tool.schema.boolean(),
      impact: tool.schema.string(),
      affected_responsibilities: tool.schema.array(tool.schema.string()),
      local_alternatives: tool.schema.array(tool.schema.string()),
      compatibility: tool.schema.string(),
      category: tool.schema.enum([
        "objective",
        "local_prerequisite",
        "milestone_change",
        "outside_objective",
      ]),
      added_surfaces: tool.schema.array(tool.schema.string()).optional(),
    }).optional(),
    milestone_id: tool.schema.string().optional(),
    requirement_id: tool.schema.string().optional(),
    fingerprint: tool.schema.string().optional(),
    classification: tool.schema.enum(["unchanged_unrelated"]).optional(),
    repository_policy_allows: tool.schema.boolean().optional(),
  },
  async execute(args, context) {
    requireProject(context);
    const id = resolveProject(context.directory, args.id);
    return render(
      reportProject(context.directory, id, args as unknown as ProjectReportInput),
    );
  },
});

export const validate = tool({
  description:
    "Run the active milestone's repository-declared gates synchronously; advance on pass or return bounded diagnostics on failure. Publish the final validated branch as a draft PR.",
  args: { id: tool.schema.string() },
  async execute(args, context) {
    requireProject(context);
    const id = resolveProject(context.directory, args.id);
    return render(await validateProject(context.directory, id));
  },
});
