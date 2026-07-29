import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

export type ProjectStatus = "design" | "active" | "waiting" | "done";
export type MilestoneStatus = "pending" | "active" | "validated";
export type ProjectTaskStatus = "pending" | "running" | "committed";
export type ImplementationTier = "s" | "m" | "l";

export interface ProjectObjective {
  outcome: string;
  acceptance_criteria: string[];
  non_goals: string[];
  guardrails: string[];
}

export interface ValidationCommand {
  id: string;
  command: string[];
  proves: string;
  timeout_ms?: number;
}

export interface FocusedCheckReport {
  requirement_id: string;
  result: "pass" | "fail";
  command: string[];
  duration_ms: number;
  diagnostic?: string;
}

export interface ProjectTaskInput {
  id: string;
  title: string;
  implementation_tier: ImplementationTier;
  tier_rationale: string;
  depends_on: string[];
  expected_surfaces: string[];
  focused_checks: ValidationCommand[];
  parallel_group?: string;
}

export interface ProjectTask extends ProjectTaskInput {
  status: ProjectTaskStatus;
  branch?: string;
  worktree?: string;
  base_revision?: string;
  revision?: string;
  changed_paths?: string[];
  focused_check_reports: FocusedCheckReport[];
  attempt: number;
}

export interface ProjectMilestoneInput {
  id: string;
  title: string;
  acceptance_criteria: string[];
  tasks: ProjectTaskInput[];
  validation: ValidationCommand[];
}

export interface ProjectMilestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  acceptance_criteria: string[];
  tasks: ProjectTask[];
  validation: ValidationCommand[];
  validated_revision?: string;
  validated_at?: string;
}

export interface ProjectEvent {
  at: string;
  kind: string;
  summary: string;
  milestone_id?: string;
  task_id?: string;
  details?: unknown;
}

export interface ValidationEvidence {
  milestone_id: string;
  requirement_id: string;
  command: string[];
  proves: string;
  result: "pass" | "fail" | "accepted_baseline";
  revision: string;
  checked_at: string;
  duration_ms: number;
  exit_code: number | null;
  log_path: string;
  failure_fingerprint?: string;
  diagnostic_tail?: string;
  baseline_comparison?: "unchanged" | "regression" | "new_failure";
}

export interface WaitingContext {
  kind: "plan_approval" | "user_question" | "publication";
  question?: string;
  rationale: string;
  task_id?: string;
  remediation?: string;
}

export interface ProjectManifest {
  schema_version: 5;
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  base_branch: string;
  base_revision: string;
  project_branch: string;
  project_worktree?: string;
  project_revision?: string;
  objective?: ProjectObjective;
  plan_revision: number;
  plan_history: Array<{
    revision: number;
    at: string;
    rationale: string;
    approved: boolean;
  }>;
  milestones: ProjectMilestone[];
  events: ProjectEvent[];
  validation_runs: ValidationEvidence[][];
  accepted_baselines: Array<{
    milestone_id: string;
    requirement_id: string;
    fingerprint: string;
    rationale: string;
    accepted_at: string;
  }>;
  waiting?: WaitingContext;
  pending_plan?: {
    objective: ProjectObjective;
    milestones: ProjectMilestoneInput[];
    rationale: string;
  };
  draft_pr_url?: string;
}

export interface ProjectPlanInput {
  objective: ProjectObjective;
  milestones: ProjectMilestoneInput[];
  rationale?: string;
  approved?: boolean;
}

export interface TaskHandle {
  project_id: string;
  milestone_id: string;
  task_id: string;
  worktree: string;
  implementation_tier: ImplementationTier;
  implementation_agent: `implement-${ImplementationTier}`;
}

export interface ProjectStatusReport {
  id: string;
  title: string;
  status: ProjectStatus;
  objective?: string;
  active_milestone?: string;
  running_tasks: string[];
  pending_tasks: string[];
  waiting?: WaitingContext;
  next_action: string;
  project_worktree?: string;
  draft_pr_url?: string;
}

export type ProjectReportInput =
  | { kind: "tier_mismatch"; task_id: string; rationale: string }
  | { kind: "research_needed"; task_id: string; rationale: string }
  | { kind: "research_completed"; task_id: string; summary: string }
  | {
    kind: "scope_review";
    task_id: string;
    assessment: {
      necessary: boolean;
      impact: string;
      affected_responsibilities: string[];
      local_alternatives: string[];
      compatibility: string;
      category:
        | "objective"
        | "local_prerequisite"
        | "milestone_change"
        | "outside_objective";
      added_surfaces?: string[];
    };
  }
  | { kind: "needs_user"; task_id: string; question: string; rationale: string }
  | { kind: "user_answer"; answer: string }
  | {
    kind: "baseline_assessment";
    milestone_id: string;
    requirement_id: string;
    fingerprint: string;
    classification: "unchanged_unrelated";
    repository_policy_allows: boolean;
    rationale: string;
  }
  | {
    kind: "implemented";
    task_id: string;
    revision?: string;
    focused_checks: FocusedCheckReport[];
  };

export interface ProjectReportResult {
  manifest: ProjectManifest;
  task?: ProjectTask;
  handle?: TaskHandle;
}

export interface ValidationResult {
  result: "passed" | "failed" | "waiting" | "done";
  manifest: ProjectManifest;
  evidence?: ValidationEvidence;
}

export interface PublicationAdapter {
  (manifest: ProjectManifest): Promise<{ url: string }>;
}

export class PublicationError extends Error {
  constructor(
    readonly code: "AUTH" | "PUBLISH",
    message: string,
  ) {
    super(message);
  }
}

const PROJECTS = ".projects";
const TIER_ORDER: ImplementationTier[] = ["s", "m", "l"];

function now(): string {
  return new Date().toISOString();
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitOptional(cwd: string, args: string[]): string | undefined {
  try {
    return git(cwd, args);
  } catch {
    return undefined;
  }
}

function statePath(base: string, id: string): string {
  return join(base, PROJECTS, id, "project.json");
}

function persist(base: string, manifest: ProjectManifest): ProjectManifest {
  manifest.updated_at = now();
  mkdirSync(dirname(statePath(base, manifest.id)), { recursive: true });
  writeFileSync(statePath(base, manifest.id), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "project";
}

function uniqueProjectId(base: string, title: string): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `${randomBytes(2).toString("hex")}-${slug(title)}`;
    if (!existsSync(statePath(base, id))) return id;
  }
  throw new Error("Could not allocate a unique project id");
}

function ensureStateDirectory(base: string): void {
  mkdirSync(join(base, PROJECTS), { recursive: true });
  const ignore = join(base, PROJECTS, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "**\n");
}

function branchName(base: string): string {
  return git(base, ["branch", "--show-current"]) ||
    git(base, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function worktreeRoot(base: string, id: string): string {
  const repositoryKey = createHash("sha256").update(resolve(base)).digest("hex").slice(0, 10);
  return join(dirname(resolve(base)), ".opencode-worktrees", repositoryKey, id);
}

function validateCommand(requirement: ValidationCommand): void {
  if (
    !requirement.id || !requirement.proves || !requirement.command.length ||
    requirement.command.some((part) => !part)
  ) throw new Error("Validation commands require id, command, and proves");
}

function validatePlan(input: ProjectPlanInput): void {
  if (!input.objective.outcome || !input.objective.acceptance_criteria.length) {
    throw new Error("The Objective requires an outcome and acceptance criteria");
  }
  if (!input.milestones.length) throw new Error("A project requires at least one milestone");
  const milestoneIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const milestone of input.milestones) {
    if (!milestone.id || !milestone.title || !milestone.acceptance_criteria.length) {
      throw new Error("Every milestone requires id, title, and acceptance criteria");
    }
    if (milestoneIds.has(milestone.id)) throw new Error(`Duplicate milestone ${milestone.id}`);
    milestoneIds.add(milestone.id);
    milestone.validation.forEach(validateCommand);
    for (const task of milestone.tasks) {
      if (
        !task.id || !task.title || !TIER_ORDER.includes(task.implementation_tier) ||
        !task.tier_rationale || !task.expected_surfaces.length
      ) throw new Error(`Task ${task.id || "<unknown>"} is incomplete or invalid`);
      if (taskIds.has(task.id)) throw new Error(`Duplicate task ${task.id}`);
      taskIds.add(task.id);
      task.focused_checks.forEach(validateCommand);
    }
  }
  for (const milestone of input.milestones) {
    for (const task of milestone.tasks) {
      for (const dependency of task.depends_on) {
        if (!taskIds.has(dependency)) throw new Error(`Unknown dependency ${dependency}`);
      }
    }
    const groups = new Map<string, ProjectTaskInput[]>();
    for (const task of milestone.tasks.filter((item) => item.parallel_group)) {
      const grouped = groups.get(task.parallel_group!) ?? [];
      grouped.push(task);
      groups.set(task.parallel_group!, grouped);
    }
    for (const [group, tasks] of groups) {
      const surfaces = new Set<string>();
      for (const task of tasks) {
        if (task.depends_on.some((id) => tasks.some((candidate) => candidate.id === id))) {
          throw new Error(`Parallel group ${group} contains a dependency`);
        }
        for (const surface of task.expected_surfaces) {
          if ([...surfaces].some((existing) => surfacesOverlap(existing, surface))) {
            throw new Error(`Parallel group ${group} has overlapping expected surfaces`);
          }
          surfaces.add(surface);
        }
      }
    }
  }
}

function taskFromInput(input: ProjectTaskInput): ProjectTask {
  return {
    ...structuredClone(input),
    status: "pending",
    focused_check_reports: [],
    attempt: 0,
  };
}

function surfacesOverlap(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/\/+$/, "");
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function milestoneFromInput(
  input: ProjectMilestoneInput,
  active: boolean,
): ProjectMilestone {
  return {
    id: input.id,
    title: input.title,
    status: active ? "active" : "pending",
    acceptance_criteria: [...input.acceptance_criteria],
    tasks: input.tasks.map(taskFromInput),
    validation: structuredClone(input.validation),
  };
}

function mergePlan(
  existing: ProjectManifest,
  inputs: ProjectMilestoneInput[],
): ProjectMilestone[] {
  return inputs.map((input, index) => {
    const previous = existing.milestones.find((item) => item.id === input.id);
    if (!previous) return milestoneFromInput(input, index === 0 && !existing.milestones.length);
    const tasks = input.tasks.map((taskInput) => {
      const task = previous.tasks.find((item) => item.id === taskInput.id);
      return task
        ? {
          ...task,
          ...structuredClone(taskInput),
          focused_check_reports: task.focused_check_reports,
        }
        : taskFromInput(taskInput);
    });
    return {
      ...previous,
      title: input.title,
      acceptance_criteria: [...input.acceptance_criteria],
      validation: structuredClone(input.validation),
      tasks,
    };
  });
}

function materialMilestoneChange(
  manifest: ProjectManifest,
  inputs: ProjectMilestoneInput[],
): boolean {
  if (manifest.status === "design") return false;
  if (manifest.milestones.length !== inputs.length) return true;
  return inputs.some((input, index) => {
    const current = manifest.milestones[index];
    return !current || current.id !== input.id ||
      JSON.stringify(current.acceptance_criteria) !==
        JSON.stringify(input.acceptance_criteria) ||
      JSON.stringify(current.validation) !== JSON.stringify(input.validation);
  });
}

function addEvent(
  manifest: ProjectManifest,
  kind: string,
  summary: string,
  task?: ProjectTask,
  details?: unknown,
): void {
  const milestone = task && findTask(manifest, task.id).milestone;
  manifest.events.push({
    at: now(),
    kind,
    summary,
    milestone_id: milestone?.id,
    task_id: task?.id,
    details,
  });
}

function findTask(
  manifest: ProjectManifest,
  taskId: string,
): { milestone: ProjectMilestone; task: ProjectTask } {
  for (const milestone of manifest.milestones) {
    const task = milestone.tasks.find((item) => item.id === taskId);
    if (task) return { milestone, task };
  }
  throw new Error(`Unknown task ${taskId}`);
}

function activeMilestone(manifest: ProjectManifest): ProjectMilestone | undefined {
  return manifest.milestones.find((item) => item.status === "active");
}

function handle(manifest: ProjectManifest, task: ProjectTask): TaskHandle {
  if (!task.worktree) throw new Error(`Task ${task.id} has not started`);
  return {
    project_id: manifest.id,
    milestone_id: findTask(manifest, task.id).milestone.id,
    task_id: task.id,
    worktree: task.worktree,
    implementation_tier: task.implementation_tier,
    implementation_agent: `implement-${task.implementation_tier}`,
  };
}

export function createProject(base: string, title: string): ProjectManifest {
  ensureStateDirectory(base);
  const id = uniqueProjectId(base, title);
  const created = now();
  return persist(base, {
    schema_version: 5,
    id,
    title,
    status: "design",
    created_at: created,
    updated_at: created,
    base_branch: branchName(base),
    base_revision: git(base, ["rev-parse", "HEAD"]),
    project_branch: `project/${id}`,
    plan_revision: 0,
    plan_history: [],
    milestones: [],
    events: [],
    validation_runs: [],
    accepted_baselines: [],
  });
}

export function readProjectManifest(base: string, id: string): ProjectManifest {
  const path = statePath(base, id);
  if (!existsSync(path)) throw new Error(`Unknown schema-v5 project ${id}`);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { schema_version?: number };
  if (parsed.schema_version !== 5) {
    throw new Error(`Project ${id} is not a schema-v5 project`);
  }
  return parsed as ProjectManifest;
}

export function listProjects(base: string): ProjectManifest[] {
  const root = join(base, PROJECTS);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        return [readProjectManifest(base, entry.name)];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function resolveProject(base: string, query: string): string {
  const matches = listProjects(base).filter((item) =>
    item.id === query || item.id.startsWith(query) ||
    item.title.toLowerCase() === query.toLowerCase()
  );
  if (matches.length === 1) return matches[0]!.id;
  if (!matches.length) throw new Error(`No schema-v5 project matches ${query}`);
  throw new Error(`Multiple schema-v5 projects match ${query}`);
}

function ensureProjectWorktree(base: string, manifest: ProjectManifest): void {
  if (manifest.project_worktree) return;
  if (git(base, ["status", "--porcelain"])) {
    throw new Error("The integration base must be clean before Project planning");
  }
  const root = worktreeRoot(base, manifest.id);
  const path = join(root, "project");
  mkdirSync(root, { recursive: true });
  git(base, [
    "worktree",
    "add",
    "-b",
    manifest.project_branch,
    path,
    manifest.base_revision,
  ]);
  manifest.project_worktree = path;
  manifest.project_revision = manifest.base_revision;
}

export function setProjectPlan(
  base: string,
  id: string,
  input: ProjectPlanInput,
): ProjectManifest {
  validatePlan(input);
  const manifest = readProjectManifest(base, id);
  const designing = manifest.status === "design";
  const material = materialMilestoneChange(manifest, input.milestones);
  if (material && !input.approved) {
    manifest.status = "waiting";
    manifest.pending_plan = {
      objective: structuredClone(input.objective),
      milestones: structuredClone(input.milestones),
      rationale: input.rationale ?? "Material milestone revision",
    };
    manifest.waiting = {
      kind: "plan_approval",
      rationale: input.rationale ?? "A milestone was added or materially changed",
    };
    addEvent(manifest, "plan_approval_requested", manifest.waiting.rationale);
    return persist(base, manifest);
  }

  manifest.objective = structuredClone(input.objective);
  manifest.milestones = mergePlan(manifest, input.milestones);
  if (designing) ensureProjectWorktree(base, manifest);
  manifest.plan_revision += 1;
  manifest.plan_history.push({
    revision: manifest.plan_revision,
    at: now(),
    rationale: input.rationale ??
      (designing
        ? input.approved ? "Initial plan approved" : "Initial draft plan"
        : "Plan adapted"),
    approved: input.approved === true,
  });

  if (designing && input.approved !== true) {
    manifest.status = "design";
    addEvent(
      manifest,
      "plan_drafted",
      `Draft plan revision ${manifest.plan_revision} created with its Project branch`,
    );
    return persist(base, manifest);
  }

  if (designing) manifest.milestones[0]!.status = "active";
  else if (!manifest.milestones.some((item) => item.status === "active")) {
    manifest.milestones.find((item) => item.status === "pending")!.status = "active";
  }
  manifest.status = "active";
  delete manifest.waiting;
  delete manifest.pending_plan;
  addEvent(manifest, "plan_stored", `Plan revision ${manifest.plan_revision} stored`);
  return persist(base, manifest);
}

function dependenciesMet(manifest: ProjectManifest, task: ProjectTask): boolean {
  return task.depends_on.every((id) => findTask(manifest, id).task.status === "committed");
}

function createParallelWorktree(
  base: string,
  manifest: ProjectManifest,
  task: ProjectTask,
): void {
  const root = worktreeRoot(base, manifest.id);
  const branch = `project-task/${manifest.id}/${task.id}/${task.attempt}`;
  const path = join(root, "tasks", `${task.id}-${task.attempt}`);
  mkdirSync(dirname(path), { recursive: true });
  git(manifest.project_worktree!, [
    "worktree",
    "add",
    "-b",
    branch,
    path,
    task.base_revision!,
  ]);
  task.branch = branch;
  task.worktree = path;
}

export function startProjectTasks(base: string, id: string): TaskHandle[] {
  const manifest = readProjectManifest(base, id);
  if (manifest.status !== "active") throw new Error(`Project ${id} is ${manifest.status}`);
  const milestone = activeMilestone(manifest);
  if (!milestone) throw new Error("No active milestone");
  const ready = milestone.tasks.filter((task) =>
    task.status === "pending" && dependenciesMet(manifest, task)
  );
  if (!ready.length) return [];

  const first = ready[0]!;
  const selected = first.parallel_group
    ? ready.filter((task) => task.parallel_group === first.parallel_group)
    : [first];
  const revision = git(manifest.project_worktree!, ["rev-parse", "HEAD"]);
  for (const task of selected) {
    task.status = "running";
    task.attempt += 1;
    task.base_revision = revision;
    if (selected.length > 1) createParallelWorktree(base, manifest, task);
    else task.worktree = manifest.project_worktree;
    addEvent(manifest, "task_started", `Started ${task.id}`, task);
  }
  persist(base, manifest);
  return selected.map((task) => handle(manifest, task));
}

export function readProjectTaskContext(
  base: string,
  id: string,
  taskId: string,
  agent?: string,
): {
  objective: ProjectObjective;
  milestone: Pick<ProjectMilestone, "id" | "title" | "acceptance_criteria">;
  task: ProjectTask;
  handle: TaskHandle;
  prior_evidence: ValidationEvidence[];
  instructions: string[];
} {
  const manifest = readProjectManifest(base, id);
  const { milestone, task } = findTask(manifest, taskId);
  const expected = `implement-${task.implementation_tier}`;
  if (agent && agent !== "project" && agent !== expected) {
    throw new Error(`Task ${taskId} is assigned to ${expected}`);
  }
  return {
    objective: manifest.objective!,
    milestone: {
      id: milestone.id,
      title: milestone.title,
      acceptance_criteria: milestone.acceptance_criteria,
    },
    task,
    handle: handle(manifest, task),
    prior_evidence: manifest.validation_runs.flat().filter((item) =>
      item.milestone_id === milestone.id
    ),
    instructions: [
      "Work only in the assigned worktree.",
      "Read root and applicable child AGENTS.md files before changing code.",
      "Run the focused checks and commit a clean cohesive result.",
      "Return one structured Project outcome.",
    ],
  };
}

function changedPaths(task: ProjectTask, revision: string): string[] {
  return git(task.worktree!, [
    "diff",
    "--name-only",
    `${task.base_revision}..${revision}`,
  ]).split("\n").filter(Boolean);
}

function removeTaskWorktree(projectWorktree: string, task: ProjectTask): void {
  if (task.worktree && task.worktree !== projectWorktree && existsSync(task.worktree)) {
    gitOptional(projectWorktree, ["worktree", "remove", "--force", task.worktree]);
    if (existsSync(task.worktree)) rmSync(task.worktree, { recursive: true, force: true });
  }
}

function serializeParallelTask(
  manifest: ProjectManifest,
  task: ProjectTask,
  reason: string,
): void {
  removeTaskWorktree(manifest.project_worktree!, task);
  task.status = "pending";
  task.parallel_group = undefined;
  task.branch = undefined;
  task.worktree = undefined;
  task.base_revision = undefined;
  task.revision = undefined;
  task.changed_paths = undefined;
  addEvent(manifest, "parallel_serialized", reason, task);
}

function composeParallel(
  manifest: ProjectManifest,
  milestone: ProjectMilestone,
  task: ProjectTask,
): boolean {
  const parallelGroup = task.parallel_group;
  const overlap = milestone.tasks
    .filter((candidate) =>
      candidate.id !== task.id && candidate.status === "committed" &&
      candidate.changed_paths?.some((path) => task.changed_paths?.includes(path))
    )
    .flatMap((candidate) =>
      candidate.changed_paths!.filter((path) => task.changed_paths!.includes(path))
    );
  if (overlap.length) {
    serializeParallelTask(
      manifest,
      task,
      `Actual changes overlap on ${[...new Set(overlap)].join(", ")}; continuing sequentially`,
    );
    return false;
  }
  try {
    git(manifest.project_worktree!, ["cherry-pick", task.revision!]);
  } catch {
    gitOptional(manifest.project_worktree!, ["cherry-pick", "--abort"]);
    serializeParallelTask(
      manifest,
      task,
      "Composition conflicted; the authoritative project worktree was restored and work continues sequentially",
    );
    for (const candidate of milestone.tasks) {
      if (
        candidate.id !== task.id && candidate.status === "running" &&
        candidate.parallel_group === parallelGroup
      ) serializeParallelTask(manifest, candidate, "Parallel composition was serialized");
    }
    return false;
  }
  removeTaskWorktree(manifest.project_worktree!, task);
  return true;
}

function reportImplemented(
  manifest: ProjectManifest,
  task: ProjectTask,
  input: Extract<ProjectReportInput, { kind: "implemented" }>,
): void {
  if (task.status !== "running" || !task.worktree) {
    throw new Error(`Task ${task.id} is not running`);
  }
  const head = git(task.worktree, ["rev-parse", "HEAD"]);
  if (git(task.worktree, ["status", "--porcelain"])) {
    throw new Error("Implementation worktree must be clean and committed");
  }
  try {
    git(task.worktree, [
      "merge-base",
      "--is-ancestor",
      task.base_revision!,
      head,
    ]);
  } catch {
    throw new Error("The assigned worktree HEAD does not descend from the task base");
  }
  if (input.revision && input.revision !== head) {
    addEvent(
      manifest,
      "revision_reconciled",
      `Observed ${task.id} at ${head}; ignored stale reported revision ${input.revision}`,
      task,
      { reported_revision: input.revision, observed_revision: head },
    );
  }
  if (input.focused_checks.some((item) => item.result !== "pass")) {
    throw new Error("Every reported focused check must pass");
  }
  const passedChecks = new Set(input.focused_checks.map((item) => item.requirement_id));
  const missingChecks = task.focused_checks.filter((item) => !passedChecks.has(item.id));
  if (missingChecks.length) {
    throw new Error(
      `Missing focused checks: ${missingChecks.map((item) => item.id).join(", ")}`,
    );
  }
  task.focused_check_reports.push(...structuredClone(input.focused_checks));
  task.revision = head;
  task.changed_paths = changedPaths(task, head);
  const { milestone } = findTask(manifest, task.id);
  if (task.worktree !== manifest.project_worktree) {
    if (!composeParallel(manifest, milestone, task)) return;
  }
  task.status = "committed";
  task.worktree = manifest.project_worktree;
  task.revision = git(manifest.project_worktree!, ["rev-parse", "HEAD"]);
  manifest.project_revision = task.revision;
  addEvent(manifest, "task_committed", `Committed ${task.id}`, task, {
    focused_checks: input.focused_checks,
    changed_paths: task.changed_paths,
  });
}

export function reportProject(
  base: string,
  id: string,
  input: ProjectReportInput,
): ProjectReportResult {
  const manifest = readProjectManifest(base, id);
  let task: ProjectTask | undefined;
  if ("task_id" in input) task = findTask(manifest, input.task_id).task;

  switch (input.kind) {
    case "tier_mismatch": {
      const current = TIER_ORDER.indexOf(task!.implementation_tier);
      if (current === TIER_ORDER.length - 1) {
        throw new Error("implement-l is already the largest tier");
      }
      task!.implementation_tier = TIER_ORDER[current + 1]!;
      task!.tier_rationale = input.rationale;
      addEvent(manifest, "tier_escalated", input.rationale, task);
      break;
    }
    case "research_needed":
      addEvent(manifest, "research_needed", input.rationale, task);
      break;
    case "research_completed":
      addEvent(manifest, "research_completed", input.summary, task);
      break;
    case "scope_review":
      addEvent(manifest, "scope_review", input.assessment.impact, task, input.assessment);
      if (
        !input.assessment.necessary ||
        ["milestone_change", "outside_objective"].includes(input.assessment.category)
      ) {
        manifest.status = "waiting";
        manifest.waiting = {
          kind: "user_question",
          task_id: task!.id,
          question: "Approve the proposed change to the project boundary?",
          rationale: input.assessment.impact,
        };
      } else {
        const added = input.assessment.added_surfaces ?? [];
        task!.expected_surfaces = [
          ...new Set([
            ...task!.expected_surfaces,
            ...added,
          ]),
        ];
        const { milestone } = findTask(manifest, task!.id);
        const overlapsParallel = milestone.tasks.filter((candidate) =>
          candidate.id !== task!.id &&
          candidate.status === "running" &&
          candidate.parallel_group === task!.parallel_group &&
          added.some((surface) =>
            candidate.expected_surfaces.some((expected) =>
              surfacesOverlap(surface, expected)
            )
          )
        );
        if (task!.parallel_group && overlapsParallel.length) {
          const group = task!.parallel_group;
          task!.parallel_group = undefined;
          for (const candidate of overlapsParallel) candidate.parallel_group = undefined;
          addEvent(
            manifest,
            "parallel_serialized",
            `Scope expansion overlaps parallel group ${group}; remaining agents run sequentially`,
            task,
          );
        }
      }
      break;
    case "needs_user":
      manifest.status = "waiting";
      manifest.waiting = {
        kind: "user_question",
        task_id: task!.id,
        question: input.question,
        rationale: input.rationale,
      };
      addEvent(manifest, "user_question", input.question, task);
      break;
    case "user_answer": {
      const waitingTask = manifest.waiting?.task_id;
      if (!waitingTask) throw new Error("Project has no task waiting for an answer");
      task = findTask(manifest, waitingTask).task;
      addEvent(manifest, "user_answer", input.answer, task);
      manifest.status = "active";
      delete manifest.waiting;
      break;
    }
    case "baseline_assessment": {
      if (!input.repository_policy_allows) {
        throw new Error("Repository policy does not allow this baseline failure");
      }
      const latest = manifest.validation_runs.flat().filter((evidence) =>
        evidence.milestone_id === input.milestone_id &&
        evidence.requirement_id === input.requirement_id &&
        evidence.result === "fail"
      ).at(-1);
      if (
        !latest || latest.failure_fingerprint !== input.fingerprint ||
        latest.baseline_comparison !== "unchanged"
      ) {
        throw new Error("Only the exact unchanged baseline failure may be accepted");
      }
      manifest.accepted_baselines.push({
        milestone_id: input.milestone_id,
        requirement_id: input.requirement_id,
        fingerprint: input.fingerprint,
        rationale: input.rationale,
        accepted_at: now(),
      });
      const milestone = manifest.milestones.find((item) =>
        item.id === input.milestone_id
      );
      const reopened = milestone?.tasks.filter((item) =>
        item.status === "running" && item.worktree === manifest.project_worktree
      ).at(-1);
      if (reopened) {
        reopened.status = "committed";
        reopened.revision = git(manifest.project_worktree!, ["rev-parse", "HEAD"]);
      }
      addEvent(
        manifest,
        "baseline_accepted",
        input.rationale,
        reopened,
        { fingerprint: input.fingerprint },
      );
      break;
    }
    case "implemented":
      reportImplemented(manifest, task!, input);
      break;
  }
  persist(base, manifest);
  return {
    manifest,
    task,
    handle: task?.worktree ? handle(manifest, task) : undefined,
  };
}

function diagnosticTail(text: string): string {
  return text.split("\n").slice(-80).join("\n").slice(-12_000);
}

function fingerprint(text: string): string {
  return createHash("sha256")
    .update(text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, "<time>"))
    .digest("hex");
}

export function compareValidationFingerprint(
  baseline: string | undefined,
  current: string,
): "unchanged" | "regression" | "new_failure" {
  if (!baseline) return "new_failure";
  return baseline === current ? "unchanged" : "regression";
}

async function executeValidation(
  cwd: string,
  requirement: ValidationCommand,
  logPath: string,
): Promise<{
  result: "pass" | "fail";
  duration_ms: number;
  exit_code: number | null;
  output: string;
}> {
  mkdirSync(dirname(logPath), { recursive: true });
  const descriptor = openSync(logPath, "w");
  const started = Date.now();
  const timeout = requirement.timeout_ms ?? 20 * 60_000;
  let timedOut = false;
  try {
    return await new Promise((resolvePromise) => {
      const child = spawn(requirement.command[0]!, requirement.command.slice(1), {
        cwd,
        detached: true,
        stdio: ["ignore", descriptor, descriptor],
      });
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          process.kill(-child.pid!, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
        setTimeout(() => {
          if (child.exitCode === null) {
            try {
              process.kill(-child.pid!, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }
        }, 500).unref();
      }, timeout);
      child.once("error", (error) => {
        clearTimeout(timer);
        writeFileSync(logPath, `Failed to start: ${error.message}\n`);
        resolvePromise({
          result: "fail",
          duration_ms: Date.now() - started,
          exit_code: null,
          output: `Failed to start: ${error.message}`,
        });
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          writeFileSync(logPath, `\nValidation timed out after ${timeout}ms\n`, { flag: "a" });
        }
        const output = readFileSync(logPath, "utf8");
        resolvePromise({
          result: code === 0 && !timedOut ? "pass" : "fail",
          duration_ms: Date.now() - started,
          exit_code: code,
          output,
        });
      });
    });
  } finally {
    closeSync(descriptor);
  }
}

async function compareFailureWithBase(
  base: string,
  manifest: ProjectManifest,
  milestone: ProjectMilestone,
  requirement: ValidationCommand,
  runNumber: number,
  currentFingerprint: string,
): Promise<"unchanged" | "regression" | "new_failure"> {
  const baselineWorktree = join(
    worktreeRoot(base, manifest.id),
    "baseline",
    `${milestone.id}-${runNumber}-${requirement.id}`,
  );
  mkdirSync(dirname(baselineWorktree), { recursive: true });
  git(base, [
    "worktree",
    "add",
    "--detach",
    baselineWorktree,
    manifest.base_revision,
  ]);
  const baselineLog = join(
    base,
    PROJECTS,
    manifest.id,
    "logs",
    `${milestone.id}-${runNumber}-${requirement.id}-base.log`,
  );
  try {
    const baseline = await executeValidation(
      baselineWorktree,
      requirement,
      baselineLog,
    );
    if (baseline.result === "pass") return "new_failure";
    return compareValidationFingerprint(
      fingerprint(baseline.output),
      currentFingerprint,
    );
  } finally {
    gitOptional(base, ["worktree", "remove", "--force", baselineWorktree]);
    if (existsSync(baselineWorktree)) {
      rmSync(baselineWorktree, { recursive: true, force: true });
    }
  }
}

async function defaultPublish(manifest: ProjectManifest): Promise<{ url: string }> {
  if (!manifest.project_worktree) throw new PublicationError("PUBLISH", "Missing worktree");
  try {
    git(manifest.project_worktree, ["status", "--porcelain"]);
    execFileSync("gh", ["auth", "status"], {
      cwd: manifest.project_worktree,
      stdio: "ignore",
    });
  } catch {
    throw new PublicationError("AUTH", "GitHub CLI authentication is missing or invalid");
  }
  try {
    git(manifest.project_worktree, [
      "push",
      "-u",
      "origin",
      manifest.project_branch,
    ]);
    const acceptance = manifest.objective!.acceptance_criteria
      .map((criterion) => `- [x] ${criterion}`)
      .join("\n");
    const url = execFileSync(
      "gh",
      [
        "pr",
        "create",
        "--draft",
        "--base",
        manifest.base_branch,
        "--head",
        manifest.project_branch,
        "--title",
        manifest.title,
        "--body",
        `## Objective\n\n${manifest.objective!.outcome}\n\n## Acceptance\n\n${acceptance}`,
      ],
      { cwd: manifest.project_worktree, encoding: "utf8" },
    ).trim();
    return { url };
  } catch (error) {
    throw new PublicationError("PUBLISH", String(error));
  }
}

export async function validateProject(
  base: string,
  id: string,
  options: { publish?: PublicationAdapter } = {},
): Promise<ValidationResult> {
  const manifest = readProjectManifest(base, id);
  if (!manifest.project_worktree) throw new Error("Project plan has not been approved");
  if (git(manifest.project_worktree, ["status", "--porcelain"])) {
    throw new Error("The project worktree must be clean before validation");
  }

  let milestone = activeMilestone(manifest);
  if (milestone && milestone.tasks.some((task) => task.status !== "committed")) {
    throw new Error("Every milestone task must be committed before validation");
  }
  if (milestone) {
    const revision = git(manifest.project_worktree, ["rev-parse", "HEAD"]);
    manifest.project_revision = revision;
    const run: ValidationEvidence[] = [];
    const runNumber = manifest.validation_runs.length + 1;
    for (const requirement of milestone.validation) {
      const relativeLog = join(
        PROJECTS,
        manifest.id,
        "logs",
        `${milestone.id}-${runNumber}-${requirement.id}.log`,
      );
      const executed = await executeValidation(
        manifest.project_worktree,
        requirement,
        join(base, relativeLog),
      );
      const evidence: ValidationEvidence = {
        milestone_id: milestone.id,
        requirement_id: requirement.id,
        command: [...requirement.command],
        proves: requirement.proves,
        result: executed.result,
        revision,
        checked_at: now(),
        duration_ms: executed.duration_ms,
        exit_code: executed.exit_code,
        log_path: relativeLog,
      };
      if (executed.result === "fail") {
        evidence.diagnostic_tail = diagnosticTail(executed.output);
        evidence.failure_fingerprint = fingerprint(executed.output);
        evidence.baseline_comparison = await compareFailureWithBase(
          base,
          manifest,
          milestone,
          requirement,
          runNumber,
          evidence.failure_fingerprint,
        );
        if (
          evidence.baseline_comparison === "unchanged" &&
          manifest.accepted_baselines.some((accepted) =>
            accepted.milestone_id === milestone!.id &&
            accepted.requirement_id === requirement.id &&
            accepted.fingerprint === evidence.failure_fingerprint
          )
        ) evidence.result = "accepted_baseline";
      }
      run.push(evidence);
      if (evidence.result === "fail") {
        const responsible = milestone.tasks.filter((task) =>
          task.status === "committed"
        ).at(-1);
        if (responsible) {
          responsible.status = "running";
          responsible.worktree = manifest.project_worktree;
          responsible.base_revision = revision;
          responsible.revision = undefined;
          responsible.changed_paths = undefined;
          responsible.attempt += 1;
        }
        manifest.validation_runs.push(run);
        addEvent(
          manifest,
          "validation_failed",
          `${requirement.id} failed; return diagnostics to implementation`,
          responsible,
          evidence,
        );
        persist(base, manifest);
        return { result: "failed", manifest, evidence };
      }
    }
    manifest.validation_runs.push(run);
    milestone.status = "validated";
    milestone.validated_revision = revision;
    milestone.validated_at = now();
    addEvent(manifest, "milestone_validated", `Validated ${milestone.id}`);
    milestone = manifest.milestones.find((item) => item.status === "pending");
    if (milestone) {
      milestone.status = "active";
      persist(base, manifest);
      return { result: "passed", manifest };
    }
  }

  try {
    const published = await (options.publish ?? defaultPublish)(manifest);
    manifest.draft_pr_url = published.url;
    manifest.status = "done";
    delete manifest.waiting;
    addEvent(manifest, "draft_pr_created", published.url);
    persist(base, manifest);
    return { result: "done", manifest };
  } catch (error) {
    const publication = error instanceof PublicationError
      ? error
      : new PublicationError("PUBLISH", String(error));
    manifest.status = "waiting";
    manifest.waiting = {
      kind: "publication",
      rationale: publication.message,
      remediation: publication.code === "AUTH" ? "gh auth login" : "Retry publication",
    };
    addEvent(manifest, "publication_waiting", publication.message);
    persist(base, manifest);
    return { result: "waiting", manifest };
  }
}

export function readProjectStatus(base: string, id: string): ProjectStatusReport {
  const manifest = readProjectManifest(base, id);
  const milestone = activeMilestone(manifest);
  const running = milestone?.tasks.filter((item) => item.status === "running") ?? [];
  const pending = milestone?.tasks.filter((item) => item.status === "pending") ?? [];
  let nextAction: string;
  if (manifest.status === "design") {
    nextAction = manifest.plan_revision
      ? "Review and approve the initial plan"
      : "Ask for the Objective before repository research";
  }
  else if (manifest.status === "waiting") {
    nextAction = manifest.waiting?.remediation ??
      manifest.waiting?.question ??
      "Resolve the pending decision";
  } else if (manifest.status === "done") nextAction = "Project is complete";
  else if (running.length) nextAction = `Resume task ${running[0]!.id}`;
  else if (pending.length) nextAction = `Start task ${pending[0]!.id}`;
  else if (milestone) nextAction = `Validate milestone ${milestone.id}`;
  else nextAction = "Publish the validated project";
  return {
    id: manifest.id,
    title: manifest.title,
    status: manifest.status,
    objective: manifest.objective?.outcome,
    active_milestone: milestone?.id,
    running_tasks: running.map((item) => item.id),
    pending_tasks: pending.map((item) => item.id),
    waiting: manifest.waiting,
    next_action: nextAction,
    project_worktree: manifest.project_worktree,
    draft_pr_url: manifest.draft_pr_url,
  };
}
