import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ProjectStatus = "design" | "active" | "blocked" | "done";
export type MilestoneStatus = "pending" | "active" | "verifying" | "verified" | "blocked";
export type ProjectTaskStatus = "ready" | "running" | "verified" | "merged" | "blocked";
export type EvidenceLevel = "task" | "milestone";

export interface EvidenceRequirement {
  id: string;
  level: EvidenceLevel;
  command: string[];
  proves: string;
  covers: string[];
  timeout_ms?: number;
}

export interface EvidenceRecord {
  requirement_id: string;
  task_id?: string;
  milestone_id?: string;
  level: EvidenceLevel;
  command: string[];
  covers: string[];
  result: "pass" | "fail";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  exit_code: number | null;
  base_revision: string;
  end_revision: string;
  changed_paths: string[];
  note: string;
  invalidated_at?: string;
  invalidated_by?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  depends_on: string[];
  allowed_paths: string[];
  forbidden_paths: string[];
  discovery_paths: string[];
  acceptance_criteria: string[];
  required_evidence: EvidenceRequirement[];
  branch?: string;
  worktree?: string;
  base_revision?: string;
  verified_revision?: string;
  attempt?: number;
  merged_at?: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  depends_on: string[];
  acceptance_criteria: string[];
  required_evidence: EvidenceRequirement[];
  tasks: ProjectTask[];
  base_revision?: string;
  verified_revision?: string;
  verified_at?: string;
}

export interface ProjectDecision {
  at: string;
  summary: string;
  rationale: string;
  milestone_id?: string;
  task_id?: string;
}

export interface ProjectManifest {
  schema_version: 3;
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  integration_branch: string;
  integration_base: string;
  milestones: ProjectMilestone[];
  evidence: EvidenceRecord[];
  decisions: ProjectDecision[];
}

export interface MilestoneSummary {
  id: string;
  title: string;
  status: MilestoneStatus;
  depends_on: string[];
  tasks: Record<ProjectTaskStatus, number>;
  gate_ids: string[];
  verified_revision?: string;
}

export interface ProjectStatusReport {
  id: string;
  title: string;
  status: ProjectStatus;
  integration_branch: string;
  current_branch: string;
  on_integration_branch: boolean;
  milestones: MilestoneSummary[];
  ready_tasks: Array<ProjectTask & { milestone_id: string }>;
  active_tasks: Array<ProjectTask & { milestone_id: string }>;
  next_action: string;
  path: string;
  metrics_path: string;
}

export interface MilestoneVerificationResult {
  manifest: ProjectManifest;
  milestone_id: string;
  revision: string;
  result: "pass" | "fail";
  evidence: EvidenceRecord[];
}

const PROJECTS_DIR = ".projects";
const MANIFEST = "project.json";
const METRICS = "metrics.jsonl";
const ID = /^(\d{4})-([a-z0-9-]+)$/;
const now = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const detail = error as Error & { stderr?: Buffer | string; stdout?: Buffer | string };
  const output = String(detail.stderr || detail.stdout || "").trim();
  return output ? `${error.message}\n${output}` : error.message;
}

function run(base: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: base,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();
}

function revision(base: string, ref = "HEAD"): string {
  return run(base, ["rev-parse", ref]);
}

function branchExists(base: string, branch: string): boolean {
  try {
    revision(base, branch);
    return true;
  } catch {
    return false;
  }
}

function defaultBranch(base: string): string {
  try {
    return run(base, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
      .replace(/^origin\//, "");
  } catch {
    for (const candidate of ["main", "master"]) {
      if (branchExists(base, candidate)) return candidate;
    }
  }
  throw new Error("Could not determine the default branch.");
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

function title(value: string): string {
  return value.trim().split(/\s+/)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function root(base: string): string {
  return join(base, PROJECTS_DIR);
}

function folder(base: string, id: string): string {
  return join(root(base), id);
}

function manifestPath(base: string, id: string): string {
  return join(folder(base, id), MANIFEST);
}

export function metricsPath(base: string, id: string): string {
  return join(folder(base, id), METRICS);
}

function ensureRoot(base: string): void {
  mkdirSync(root(base), { recursive: true });
  const ignore = join(root(base), ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "**\n!.gitignore\n");
}

export function readProjectManifest(base: string, id: string): ProjectManifest {
  const file = manifestPath(base, id);
  if (!existsSync(file)) throw new Error(`Project not found: ${id}`);
  const value = JSON.parse(readFileSync(file, "utf8")) as { schema_version?: number };
  if (value.schema_version !== 3) {
    throw new Error(
      `Project ${id} uses unsupported schema ${value.schema_version ?? "unknown"}; create a new project.`,
    );
  }
  return value as ProjectManifest;
}

function write(base: string, manifest: ProjectManifest): void {
  mkdirSync(folder(base, manifest.id), { recursive: true });
  writeFileSync(manifestPath(base, manifest.id), `${JSON.stringify(manifest, null, 2)}\n`);
}

function matches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("?", "[^/]")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function changed(base: string, from: string, to = "HEAD"): string[] {
  return run(base, ["diff", "--name-only", `${from}...${to}`]).split("\n")
    .map((item) => item.trim()).filter(Boolean);
}

function milestone(manifest: ProjectManifest, milestoneId: string): ProjectMilestone {
  const value = manifest.milestones.find((item) => item.id === milestoneId);
  if (!value) throw new Error(`Project milestone not found: ${milestoneId}`);
  return value;
}

function locatedTask(
  manifest: ProjectManifest,
  taskId: string,
): { milestone: ProjectMilestone; task: ProjectTask } {
  for (const owner of manifest.milestones) {
    const task = owner.tasks.find((item) => item.id === taskId);
    if (task) return { milestone: owner, task };
  }
  throw new Error(`Project task not found: ${taskId}`);
}

function milestoneDependenciesMet(manifest: ProjectManifest, item: ProjectMilestone): boolean {
  return item.depends_on.every((dependency) =>
    milestone(manifest, dependency).status === "verified"
  );
}

function taskDependenciesMet(owner: ProjectMilestone, item: ProjectTask): boolean {
  return item.depends_on.every((dependency) =>
    owner.tasks.find((task) => task.id === dependency)?.status === "merged"
  );
}

function refreshMilestones(manifest: ProjectManifest): void {
  if (manifest.status === "design" || manifest.status === "done") return;
  for (const item of manifest.milestones) {
    if (item.status === "verified" || item.status === "blocked") continue;
    if (!milestoneDependenciesMet(manifest, item)) {
      item.status = "pending";
      continue;
    }
    item.status = item.tasks.every((task) => task.status === "merged")
      ? "verifying"
      : "active";
  }
}

function staticPrefix(pattern: string): string {
  const index = pattern.search(/[?*]/);
  return pattern.slice(0, index < 0 ? pattern.length : index);
}

function overlappingWrites(left: ProjectTask, right: ProjectTask): boolean {
  return left.allowed_paths.some((a) => right.allowed_paths.some((b) => {
    const aPrefix = staticPrefix(a);
    const bPrefix = staticPrefix(b);
    return a === b || aPrefix.startsWith(bPrefix) || bPrefix.startsWith(aPrefix) ||
      matches(a.replace(/[?*].*$/, "x"), b) || matches(b.replace(/[?*].*$/, "x"), a);
  }));
}

function reservesWrites(item: ProjectTask): boolean {
  return ["running", "verified"].includes(item.status);
}

function scopeViolations(
  base: string,
  item: ProjectTask,
  from: string,
  to = "HEAD",
): string[] {
  return changed(base, from, to).filter((path) =>
    item.forbidden_paths.some((pattern) => matches(path, pattern)) ||
    !item.allowed_paths.some((pattern) => matches(path, pattern))
  );
}

function assertAcyclic(items: Array<{ id: string; depends_on: string[] }>, label: string): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(items.map((item) => [item.id, item]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`${label} dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of items) visit(item.id);
}

function validateRequirement(
  requirement: EvidenceRequirement,
  expectedLevel: EvidenceLevel,
  evidenceIds: Set<string>,
): void {
  if (
    requirement.level !== expectedLevel || !requirement.id.trim() ||
    !requirement.command.length || requirement.command.some((part) => !part.trim()) ||
    !requirement.proves.trim() || !requirement.covers.length ||
    evidenceIds.has(requirement.id)
  ) {
    throw new Error(`Project evidence must be complete and uniquely identified: ${requirement.id}`);
  }
  if (
    requirement.timeout_ms !== undefined &&
    (!Number.isFinite(requirement.timeout_ms) || requirement.timeout_ms <= 0 ||
      requirement.timeout_ms > 1_800_000)
  ) {
    throw new Error(
      `Project evidence timeout must be between 1 and 1800000ms: ${requirement.id}`,
    );
  }
  evidenceIds.add(requirement.id);
}

function validateMilestones(milestones: ProjectMilestone[]): void {
  const milestoneIds = new Set<string>();
  const taskIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const item of milestones) {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || milestoneIds.has(item.id)) {
      throw new Error(`Milestone IDs must be unique kebab-case: ${item.id}`);
    }
    milestoneIds.add(item.id);
    if (!item.title.trim() || !item.acceptance_criteria.length ||
      !item.required_evidence.length) {
      throw new Error(`Milestone ${item.id} needs a title, acceptance criteria, and gates.`);
    }
    for (const requirement of item.required_evidence) {
      validateRequirement(requirement, "milestone", evidenceIds);
    }
    const localTaskIds = new Set<string>();
    for (const task of item.tasks) {
      if (
        !/^[a-z][a-z0-9-]*$/.test(task.id) || taskIds.has(task.id) ||
        localTaskIds.has(task.id)
      ) {
        throw new Error(`Task IDs must be globally unique kebab-case: ${task.id}`);
      }
      taskIds.add(task.id);
      localTaskIds.add(task.id);
      if (!task.title.trim() || !task.allowed_paths.length ||
        !task.acceptance_criteria.length) {
        throw new Error(`Task ${task.id} needs a title, writable paths, and acceptance criteria.`);
      }
      for (const requirement of task.required_evidence) {
        validateRequirement(requirement, "task", evidenceIds);
      }
    }
    for (const task of item.tasks) {
      if (task.depends_on.some((dependency) =>
        !localTaskIds.has(dependency) || dependency === task.id
      )) {
        throw new Error(`Task ${task.id} has a dependency outside milestone ${item.id}.`);
      }
    }
    assertAcyclic(item.tasks, "Task");
  }
  for (const item of milestones) {
    if (item.depends_on.some((dependency) =>
      !milestoneIds.has(dependency) || dependency === item.id
    )) {
      throw new Error(`Milestone ${item.id} has an invalid dependency.`);
    }
  }
  assertAcyclic(milestones, "Milestone");
}

function activeTasks(manifest: ProjectManifest): ProjectTask[] {
  return manifest.milestones.flatMap((item) => item.tasks)
    .filter((item) => reservesWrites(item));
}

function worktreeRoot(
  base: string,
  manifest: ProjectManifest,
  task: ProjectTask,
  attempt: number,
): string {
  return join(
    dirname(base),
    ".opencode-worktrees",
    hash(base).slice(0, 16),
    manifest.id,
    task.id,
    String(attempt),
  );
}

function assertIntegrationBranch(base: string, manifest: ProjectManifest): void {
  const current = run(base, ["branch", "--show-current"]);
  if (current !== manifest.integration_branch) {
    throw new Error(
      `Operation requires ${manifest.integration_branch}; current branch is ${current || "(detached)"}.`,
    );
  }
}

function integrationDirty(base: string): string[] {
  return run(base, ["status", "--porcelain"]).split("\n").filter(Boolean)
    .filter((line) =>
      !line.endsWith(" .projects/.gitignore") && !line.endsWith(" .projects/")
    );
}

function latestEvidence(
  manifest: ProjectManifest,
  requirementId: string,
  taskId?: string,
  milestoneId?: string,
): EvidenceRecord | undefined {
  return manifest.evidence.filter((record) =>
    record.requirement_id === requirementId &&
    record.task_id === taskId &&
    record.milestone_id === milestoneId
  ).at(-1);
}

function isFresh(
  record: EvidenceRecord | undefined,
  requirement: EvidenceRequirement,
  expectedRevision: string,
): boolean {
  return record?.result === "pass" && !record.invalidated_at &&
    record.level === requirement.level &&
    JSON.stringify(record.command) === JSON.stringify(requirement.command) &&
    JSON.stringify(record.covers) === JSON.stringify(requirement.covers) &&
    record.end_revision === expectedRevision;
}

function runRequirement(
  base: string,
  manifest: ProjectManifest,
  requirement: EvidenceRequirement,
  context: { task?: ProjectTask; milestone?: ProjectMilestone },
): EvidenceRecord {
  const cwd = context.task?.worktree ?? base;
  const baseRevision = context.task?.base_revision ??
    context.milestone?.base_revision ?? revision(base);
  const executable = requirement.command[0]!;
  const args = requirement.command.slice(1);
  const executableName = executable.split("/").at(-1)?.toLowerCase();
  const unsafeGit = executableName === "git" &&
    (["reset", "clean", "restore"].includes(args[0] ?? "") ||
      (args[0] === "checkout" && args[1] === "--") ||
      (args[0] === "push" &&
        args.some((arg) => arg === "-f" || arg.startsWith("--force"))));
  if (["rm", "sudo", "sh", "bash", "zsh", "fish"].includes(executableName ?? "") ||
    unsafeGit) {
    throw new Error(`Unsafe evidence command is not allowed: ${requirement.id}`);
  }
  const packageWorktree = Boolean(context.task?.worktree);
  const dirty = run(cwd, ["status", "--porcelain"]).split("\n").filter(Boolean)
    .filter((line) =>
      packageWorktree ||
      (!line.endsWith(" .projects/.gitignore") && !line.endsWith(" .projects/"))
    );
  if (dirty.length) {
    throw new Error(
      `Evidence requires a clean ${packageWorktree ? "task" : "integration"} worktree: ${requirement.id}`,
    );
  }
  const timeout = requirement.timeout_ms ??
    (requirement.level === "milestone" ? 900_000 : 300_000);
  const started = Date.now();
  const startedAt = now();
  const result = spawnSync(executable, args, {
    cwd,
    shell: false,
    encoding: "utf8",
    timeout,
  });
  const code = typeof result.status === "number" ? result.status : null;
  const failure = [
    result.error?.message,
    result.signal ? `terminated by ${result.signal}` : undefined,
    result.stderr,
    result.stdout,
  ].filter(Boolean).join("\n").trim();
  const record: EvidenceRecord = {
    requirement_id: requirement.id,
    ...(context.task ? { task_id: context.task.id } : {}),
    ...(context.milestone ? { milestone_id: context.milestone.id } : {}),
    level: requirement.level,
    command: requirement.command,
    covers: requirement.covers,
    result: code === 0 ? "pass" : "fail",
    started_at: startedAt,
    finished_at: now(),
    duration_ms: Date.now() - started,
    exit_code: code,
    base_revision: baseRevision,
    end_revision: revision(cwd),
    changed_paths: changed(cwd, baseRevision),
    note: code === 0 ? requirement.proves : (failure || "command failed").slice(0, 4000),
  };
  manifest.evidence.push(record);
  return record;
}

function invalidateEvidence(
  manifest: ProjectManifest,
  predicate: (record: EvidenceRecord) => boolean,
  reason: string,
): void {
  for (const record of manifest.evidence) {
    if (!record.invalidated_at && predicate(record)) {
      record.invalidated_at = now();
      record.invalidated_by = reason;
    }
  }
}

function emptyTaskCounts(): Record<ProjectTaskStatus, number> {
  return { ready: 0, running: 0, verified: 0, merged: 0, blocked: 0 };
}

function readyTaskEntries(
  manifest: ProjectManifest,
): Array<ProjectTask & { milestone_id: string }> {
  const active = activeTasks(manifest);
  return manifest.milestones.flatMap((owner) =>
    owner.status === "active"
      ? owner.tasks.filter((task) =>
        task.status === "ready" && taskDependenciesMet(owner, task) &&
        !active.some((other) => other.id !== task.id && overlappingWrites(task, other))
      ).map((task) => ({ ...task, milestone_id: owner.id }))
      : []
  );
}

function nextAction(
  manifest: ProjectManifest,
  ready: Array<ProjectTask & { milestone_id: string }>,
): string {
  if (manifest.status === "done") return "done";
  if (manifest.status === "blocked") return "resolve the recorded blocker";
  if (manifest.status === "design") return "plan milestones and tasks";
  if (ready.length) return `dispatch ${ready.map((item) => item.id).join(", ")}`;
  const running = activeTasks(manifest);
  if (running.length) return `finish ${running.map((item) => item.id).join(", ")}`;
  const verifying = manifest.milestones.filter((item) => item.status === "verifying");
  if (verifying.length) {
    return `verify milestone ${verifying.map((item) => item.id).join(", ")}`;
  }
  if (manifest.milestones.every((item) => item.status === "verified")) return "close project";
  return "inspect blocked dependencies";
}

export function summarizeProject(base: string, manifest: ProjectManifest): ProjectStatusReport {
  refreshMilestones(manifest);
  const ready = readyTaskEntries(manifest);
  let currentBranch = "";
  try {
    currentBranch = run(base, ["branch", "--show-current"]);
  } catch {
    // A status report remains useful when Git state cannot be read.
  }
  return {
    id: manifest.id,
    title: manifest.title,
    status: manifest.status,
    integration_branch: manifest.integration_branch,
    current_branch: currentBranch,
    on_integration_branch: currentBranch === manifest.integration_branch,
    milestones: manifest.milestones.map((item) => {
      const tasks = emptyTaskCounts();
      for (const task of item.tasks) tasks[task.status] += 1;
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        depends_on: item.depends_on,
        tasks,
        gate_ids: item.required_evidence.map((gate) => gate.id),
        ...(item.verified_revision ? { verified_revision: item.verified_revision } : {}),
      };
    }),
    ready_tasks: ready,
    active_tasks: manifest.milestones.flatMap((owner) =>
      owner.tasks.filter((task) => reservesWrites(task) || task.status === "blocked")
        .map((task) => ({ ...task, milestone_id: owner.id }))
    ),
    next_action: nextAction(manifest, ready),
    path: `${PROJECTS_DIR}/${manifest.id}/${MANIFEST}`,
    metrics_path: `${PROJECTS_DIR}/${manifest.id}/${METRICS}`,
  };
}

export function resolveProject(base: string, idOrName: string): string {
  const input = idOrName.trim();
  if (!input) throw new Error("Project ID or name is required.");
  if (existsSync(manifestPath(base, input))) return input;
  ensureRoot(base);
  const entries = readdirSync(root(base)).filter((entry) =>
    ID.test(entry) && existsSync(manifestPath(base, entry))
  );
  const numeric = /^\d{1,4}$/.test(input) ? input.padStart(4, "0") : undefined;
  const name = slug(input);
  const found = entries.filter((entry) =>
    numeric ? entry.startsWith(`${numeric}-`) : entry === name || entry.endsWith(`-${name}`)
  );
  if (found.length === 1) return found[0]!;
  if (found.length > 1) throw new Error(`Ambiguous project ${input}: ${found.join(", ")}`);
  throw new Error(`Project not found: ${input}`);
}

export function createProject(base: string, description: string): ProjectManifest {
  ensureRoot(base);
  run(base, ["rev-parse", "--is-inside-work-tree"]);
  const name = slug(description);
  if (!name) throw new Error("Project name must contain an alphanumeric character.");
  const highest = readdirSync(root(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && ID.test(entry.name))
    .reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 4))), 0);
  const id = `${String(highest + 1).padStart(4, "0")}-${name}`;
  const integrationBranch = `project/${id}`;
  if (branchExists(base, integrationBranch)) {
    throw new Error(`Project branch already exists: ${integrationBranch}`);
  }
  const source = defaultBranch(base);
  run(base, ["branch", integrationBranch, source]);
  run(base, ["switch", integrationBranch]);
  const manifest: ProjectManifest = {
    schema_version: 3,
    id,
    title: title(description),
    status: "design",
    created_at: now(),
    updated_at: now(),
    integration_branch: integrationBranch,
    integration_base: revision(base, source),
    milestones: [],
    evidence: [],
    decisions: [],
  };
  write(base, manifest);
  return manifest;
}

export function setProjectPlan(
  base: string,
  id: string,
  milestones: ProjectMilestone[],
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  if (manifest.status !== "design") throw new Error(`Project ${id} is not in design.`);
  const normalized = milestones.map((item) => ({
    ...item,
    status: "pending" as const,
    depends_on: item.depends_on ?? [],
    acceptance_criteria: item.acceptance_criteria ?? [],
    required_evidence: item.required_evidence ?? [],
    tasks: (item.tasks ?? []).map((task) => ({
      ...task,
      status: "ready" as const,
      depends_on: task.depends_on ?? [],
      allowed_paths: task.allowed_paths ?? [],
      forbidden_paths: task.forbidden_paths ?? [],
      discovery_paths: task.discovery_paths ?? [],
      acceptance_criteria: task.acceptance_criteria ?? [],
      required_evidence: task.required_evidence ?? [],
    })),
  }));
  validateMilestones(normalized);
  manifest.milestones = normalized;
  manifest.status = "active";
  refreshMilestones(manifest);
  for (const item of manifest.milestones.filter((entry) => entry.status === "active")) {
    item.base_revision = revision(base);
  }
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function readProjectStatus(base: string, id: string): ProjectStatusReport {
  return summarizeProject(base, readProjectManifest(base, id));
}

export function inspectProjectItem(
  base: string,
  id: string,
  milestoneId: string,
  taskId?: string,
): ProjectMilestone | ProjectTask {
  const manifest = readProjectManifest(base, id);
  const owner = milestone(manifest, milestoneId);
  if (!taskId) return owner;
  const task = owner.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task ${taskId} does not belong to milestone ${milestoneId}.`);
  return task;
}

export function dispatchProjectTask(base: string, id: string, taskId: string): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  refreshMilestones(manifest);
  if (manifest.status !== "active") throw new Error(`Project ${id} is not active.`);
  const { milestone: owner, task } = locatedTask(manifest, taskId);
  if (owner.status !== "active" || task.status !== "ready") {
    throw new Error(`Project task ${taskId} is not ready.`);
  }
  if (!taskDependenciesMet(owner, task)) {
    throw new Error(`Dependencies are not complete for ${taskId}.`);
  }
  if (activeTasks(manifest).some((other) =>
    other.id !== task.id && overlappingWrites(task, other)
  )) {
    throw new Error(`Project task ${taskId} overlaps active work.`);
  }
  let attempt = (task.attempt ?? 0) + 1;
  let branch = `work/${manifest.id}-${task.id}-${attempt}`;
  let worktree = worktreeRoot(base, manifest, task, attempt);
  while (branchExists(base, branch) || existsSync(worktree)) {
    attempt += 1;
    branch = `work/${manifest.id}-${task.id}-${attempt}`;
    worktree = worktreeRoot(base, manifest, task, attempt);
  }
  mkdirSync(dirname(worktree), { recursive: true });
  run(base, ["worktree", "add", "-b", branch, worktree, manifest.integration_branch]);
  task.attempt = attempt;
  task.branch = branch;
  task.worktree = worktree;
  task.base_revision = revision(worktree);
  task.status = "running";
  owner.base_revision ??= revision(base);
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function verifyProjectTaskRequirement(
  base: string,
  id: string,
  taskId: string,
  requirementId: string,
): { manifest: ProjectManifest; evidence: EvidenceRecord } {
  const manifest = readProjectManifest(base, id);
  const { task } = locatedTask(manifest, taskId);
  if (task.status !== "running" || !task.worktree || !task.base_revision) {
    throw new Error(`Task evidence requires a running task: ${taskId}`);
  }
  const requirement = task.required_evidence.find((entry) => entry.id === requirementId);
  if (!requirement) throw new Error(`Unknown task evidence requirement: ${requirementId}`);
  const evidence = runRequirement(base, manifest, requirement, { task });
  manifest.updated_at = now();
  write(base, manifest);
  return { manifest, evidence };
}

export function markProjectTaskVerified(
  base: string,
  id: string,
  taskId: string,
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  const { task } = locatedTask(manifest, taskId);
  if (task.status !== "running" || !task.worktree || !task.base_revision) {
    throw new Error(`Project task ${taskId} is not running.`);
  }
  const violations = scopeViolations(task.worktree, task, task.base_revision);
  if (violations.length) {
    throw new Error(`Project task ${taskId} changed paths outside its contract: ${violations.join(", ")}`);
  }
  const end = revision(task.worktree);
  const missing = task.required_evidence.filter((requirement) =>
    !isFresh(latestEvidence(manifest, requirement.id, task.id), requirement, end)
  );
  if (missing.length) {
    throw new Error(`Fresh task evidence is required: ${missing.map((item) => item.id).join(", ")}`);
  }
  task.status = "verified";
  task.verified_revision = end;
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function mergeProjectTask(base: string, id: string, taskId: string): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  const { milestone: owner, task } = locatedTask(manifest, taskId);
  assertIntegrationBranch(base, manifest);
  if (
    task.status !== "verified" || !task.branch || !task.worktree ||
    !task.base_revision || !task.verified_revision
  ) {
    throw new Error(`Project task ${taskId} is not verified for merge.`);
  }
  if (run(task.worktree, ["status", "--porcelain"])) {
    throw new Error(`Project task ${taskId} has uncommitted changes after verification.`);
  }
  if (revision(task.worktree) !== task.verified_revision) {
    throw new Error(`Project task ${taskId} changed after verification.`);
  }
  const stale = task.required_evidence.filter((requirement) =>
    !isFresh(
      latestEvidence(manifest, requirement.id, task.id),
      requirement,
      task.verified_revision!,
    )
  );
  if (stale.length) {
    throw new Error(`Task evidence became stale: ${stale.map((item) => item.id).join(", ")}`);
  }
  const violations = scopeViolations(task.worktree, task, task.base_revision);
  if (violations.length) {
    throw new Error(`Project task ${taskId} changed paths outside its contract: ${violations.join(", ")}`);
  }
  if (integrationDirty(base).length) {
    throw new Error("The integration worktree must be clean before merge.");
  }
  try {
    run(base, ["merge", "--no-ff", "--no-commit", task.branch]);
    run(base, ["-c", "commit.gpgsign=false", "commit", "--no-edit"]);
  } catch (error) {
    try {
      run(base, ["merge", "--abort"]);
    } catch {
      // Preserve the original failure.
    }
    throw new Error(`Merge failed for ${taskId}: ${errorMessage(error)}`);
  }
  task.status = "merged";
  task.merged_at = now();
  refreshMilestones(manifest);
  if (owner.status === "verifying") owner.base_revision ??= manifest.integration_base;
  manifest.updated_at = now();
  write(base, manifest);
  try {
    run(base, ["worktree", "remove", task.worktree]);
    task.worktree = undefined;
    write(base, manifest);
  } catch {
    // Merged state remains authoritative; a stale worktree does not block later attempts.
  }
  return manifest;
}

export function requeueProjectTask(
  base: string,
  id: string,
  taskId: string,
  rationale: string,
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  const { milestone: owner, task } = locatedTask(manifest, taskId);
  if (task.status === "merged") throw new Error(`Merged task ${taskId} cannot be requeued.`);
  if (task.worktree && existsSync(task.worktree)) {
    if (run(task.worktree, ["status", "--porcelain"])) {
      throw new Error(`Project task ${taskId} has uncommitted changes.`);
    }
    run(base, ["worktree", "remove", task.worktree]);
  }
  invalidateEvidence(
    manifest,
    (record) => record.task_id === taskId,
    `requeued ${taskId}: ${rationale}`,
  );
  task.status = "ready";
  task.branch = undefined;
  task.worktree = undefined;
  task.base_revision = undefined;
  task.verified_revision = undefined;
  owner.status = "active";
  manifest.status = "active";
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function updateProjectTask(
  base: string,
  id: string,
  milestoneId: string,
  replacement: ProjectTask,
  rationale: string,
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  const owner = milestone(manifest, milestoneId);
  if (owner.status === "verified") {
    throw new Error(`Verified milestone ${milestoneId} is immutable.`);
  }
  const index = owner.tasks.findIndex((item) => item.id === replacement.id);
  const existing = index >= 0 ? owner.tasks[index] : undefined;
  if (existing?.status === "merged") throw new Error(`Merged task ${replacement.id} is immutable.`);
  const normalized: ProjectTask = existing?.worktree
    ? {
      ...replacement,
      status: "running",
      branch: existing.branch,
      worktree: existing.worktree,
      base_revision: existing.base_revision,
      attempt: existing.attempt,
      verified_revision: undefined,
    }
    : {
      ...replacement,
      status: "ready",
      attempt: existing?.attempt,
      branch: undefined,
      worktree: undefined,
      base_revision: undefined,
      verified_revision: undefined,
    };
  if (index >= 0) owner.tasks[index] = normalized;
  else owner.tasks.push(normalized);
  validateMilestones(manifest.milestones);
  if (existing?.worktree && !taskDependenciesMet(owner, normalized)) {
    throw new Error(`Running task ${replacement.id} cannot gain an unmet dependency.`);
  }
  invalidateEvidence(
    manifest,
    (record) => record.task_id === replacement.id,
    `updated ${replacement.id}: ${rationale}`,
  );
  owner.status = "active";
  owner.verified_revision = undefined;
  owner.verified_at = undefined;
  manifest.status = "active";
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function updateEvidenceRequirement(
  base: string,
  id: string,
  ownerType: "task" | "milestone",
  ownerId: string,
  requirement: EvidenceRequirement,
  rationale: string,
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  let requirements: EvidenceRequirement[];
  if (ownerType === "task") {
    const { task } = locatedTask(manifest, ownerId);
    if (task.status === "merged") throw new Error(`Merged task ${ownerId} is immutable.`);
    if (requirement.level !== "task") throw new Error("Task evidence must use level task.");
    requirements = task.required_evidence;
  } else {
    const item = milestone(manifest, ownerId);
    if (item.status === "verified") throw new Error(`Verified milestone ${ownerId} is immutable.`);
    if (requirement.level !== "milestone") {
      throw new Error("Milestone evidence must use level milestone.");
    }
    requirements = item.required_evidence;
  }
  const index = requirements.findIndex((item) => item.id === requirement.id);
  if (index < 0) throw new Error(`Evidence requirement not found: ${requirement.id}`);
  requirements[index] = requirement;
  validateMilestones(manifest.milestones);
  invalidateEvidence(
    manifest,
    (record) =>
      record.requirement_id === requirement.id &&
      (ownerType === "task" ? record.task_id === ownerId : record.milestone_id === ownerId),
    `updated evidence ${requirement.id}: ${rationale}`,
  );
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function verifyProjectMilestone(
  base: string,
  id: string,
  milestoneId: string,
): MilestoneVerificationResult {
  const manifest = readProjectManifest(base, id);
  refreshMilestones(manifest);
  const item = milestone(manifest, milestoneId);
  assertIntegrationBranch(base, manifest);
  if (item.status !== "verifying") {
    throw new Error(`Milestone ${milestoneId} is not ready for verification.`);
  }
  if (integrationDirty(base).length) {
    throw new Error("The integration worktree must be clean before milestone verification.");
  }
  const end = revision(base);
  item.base_revision ??= end;
  const records = item.required_evidence.map((requirement) =>
    runRequirement(base, manifest, requirement, { milestone: item })
  );
  if (records.every((record) => record.result === "pass" && record.end_revision === end)) {
    item.status = "verified";
    item.verified_revision = end;
    item.verified_at = now();
    refreshMilestones(manifest);
  }
  manifest.updated_at = now();
  write(base, manifest);
  return {
    manifest,
    milestone_id: milestoneId,
    revision: end,
    result: records.every((record) => record.result === "pass") ? "pass" : "fail",
    evidence: records,
  };
}

export function recordProjectDecision(
  base: string,
  id: string,
  summary: string,
  rationale: string,
  milestoneId?: string,
  taskId?: string,
): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  if (milestoneId) milestone(manifest, milestoneId);
  if (taskId) locatedTask(manifest, taskId);
  manifest.decisions.push({
    at: now(),
    summary,
    rationale,
    ...(milestoneId ? { milestone_id: milestoneId } : {}),
    ...(taskId ? { task_id: taskId } : {}),
  });
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function closeProject(base: string, id: string, note: string): ProjectManifest {
  const manifest = readProjectManifest(base, id);
  assertIntegrationBranch(base, manifest);
  refreshMilestones(manifest);
  if (integrationDirty(base).length) {
    throw new Error("The integration worktree must be clean before project close.");
  }
  const incomplete = manifest.milestones.filter((item) => item.status !== "verified");
  if (incomplete.length) {
    throw new Error(
      `Unverified milestones remain: ${incomplete.map((item) => item.id).join(", ")}`,
    );
  }
  manifest.status = "done";
  manifest.decisions.push({
    at: now(),
    summary: "Project closed",
    rationale: note,
  });
  manifest.updated_at = now();
  write(base, manifest);
  return manifest;
}

export function listProjects(base: string): ProjectStatusReport[] {
  ensureRoot(base);
  return readdirSync(root(base), { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory() && ID.test(entry.name) &&
      existsSync(manifestPath(base, entry.name))
    )
    .filter((entry) => {
      try {
        const value = JSON.parse(readFileSync(manifestPath(base, entry.name), "utf8")) as {
          schema_version?: number;
        };
        return value.schema_version === 3;
      } catch {
        return false;
      }
    })
    .map((entry) => readProjectStatus(base, entry.name))
    .sort((a, b) => b.id.localeCompare(a.id));
}

export function formatProjectReport(report: ProjectStatusReport): string {
  return [
    `Project: ${report.id} - ${report.title}`,
    `Status: ${report.status}`,
    `Branch: ${report.integration_branch}`,
    `Milestones: ${report.milestones.map((item) => `${item.id}=${item.status}`).join(", ") || "none"}`,
    `Ready tasks: ${report.ready_tasks.map((item) => item.id).join(", ") || "none"}`,
    `Active tasks: ${report.active_tasks.map((item) => `${item.id}=${item.status}`).join(", ") || "none"}`,
    `Next: ${report.next_action}`,
    `Trace: ${report.metrics_path}`,
  ].join("\n");
}
