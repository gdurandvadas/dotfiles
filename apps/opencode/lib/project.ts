import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export type ProjectStatus = "design" | "preflight" | "active" | "blocked" | "done";
export type PreflightStatus =
  | "pending"
  | "verifying"
  | "failed"
  | "repairing"
  | "passed"
  | "excepted";
export type MilestoneStatus =
  | "pending"
  | "active"
  | "verifying"
  | "repairing"
  | "verified";
export type ProjectTaskStatus = "ready" | "running" | "merged" | "blocked";
export type EvidenceLevel = "preflight" | "task" | "milestone";
export type ImplementationTier = "s" | "m" | "l";
export type ProjectTaskKind = "normal" | "gate-repair";
export type EvidenceOwnerType = "preflight" | "task" | "milestone";

export interface EvidenceRequirement {
  id: string;
  level: EvidenceLevel;
  command: string[];
  proves: string;
  timeout_ms?: number;
}

export interface EvidenceAttempt {
  requirement_id: string;
  owner_type: EvidenceOwnerType;
  owner_id: string;
  level: EvidenceLevel;
  attempt: number;
  result: "pass" | "fail";
  checked_at: string;
  duration_ms: number;
  exit_code: number | null;
  revision: string;
  failure_fingerprint?: string;
  diagnostic_tail?: string;
  log_path: string;
}

export interface EvidenceRun {
  id: string;
  requirement_id: string;
  owner_type: EvidenceOwnerType;
  owner_id: string;
  level: EvidenceLevel;
  command: string[];
  started_at: string;
  timeout_ms: number;
  revision: string;
  log_path: string;
  result_path: string;
  runner_pid: number;
  proves?: string;
  sequence_position?: number;
  sequence_total?: number;
}

export interface GateBinding {
  owner_type: "preflight" | "milestone";
  owner_id: string;
  requirement_id: string;
}

export interface ProjectTaskInput {
  id: string;
  title: string;
  kind: ProjectTaskKind;
  implementation_tier: ImplementationTier;
  tier_rationale: string;
  depends_on: string[];
  allowed_paths: string[];
  excluded_paths?: string[];
  acceptance_criteria: string[];
  required_evidence: EvidenceRequirement[];
}

export interface ProjectTask extends ProjectTaskInput {
  status: ProjectTaskStatus;
  gate_binding?: GateBinding;
  branch?: string;
  worktree?: string;
  base_revision?: string;
  verified_revision?: string;
  attempt?: number;
  merged_at?: string;
}

export interface ProjectMilestoneInput {
  id: string;
  title: string;
  depends_on: string[];
  acceptance_criteria: string[];
  required_evidence: EvidenceRequirement[];
  tasks: ProjectTaskInput[];
}

export interface ProjectMilestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  depends_on: string[];
  acceptance_criteria: string[];
  required_evidence: EvidenceRequirement[];
  tasks: ProjectTask[];
  failed_gate_id?: string;
  failure_fingerprint?: string;
  verified_revision?: string;
  verified_at?: string;
}

export interface ProjectPreflight {
  status: PreflightStatus;
  required_evidence: EvidenceRequirement[];
  repairs: ProjectTask[];
  failed_requirement_id?: string;
  failure_fingerprint?: string;
  verified_revision?: string;
  resolved_at?: string;
  exception_rationale?: string;
}

export interface ProjectDecision {
  at: string;
  summary: string;
  rationale: string;
  milestone_id?: string;
  task_id?: string;
}

export interface ProjectManifest {
  schema_version: 4;
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  integration_branch: string;
  integration_base: string;
  preflight: ProjectPreflight;
  milestones: ProjectMilestone[];
  evidence: EvidenceAttempt[];
  active_evidence?: EvidenceRun[];
  decisions: ProjectDecision[];
}

export interface TaskSummary {
  id: string;
  title: string;
  kind: ProjectTaskKind;
  status: ProjectTaskStatus;
  owner_id: string;
  implementation_tier: ImplementationTier;
  implementation_agent: string;
  attempt?: number;
}

export interface ProjectStatusReport {
  id: string;
  title: string;
  status: ProjectStatus;
  integration_branch: string;
  current_branch: string;
  on_integration_branch: boolean;
  preflight: {
    status: PreflightStatus;
    evidence_ids: string[];
    failed_requirement_id?: string;
  };
  milestones: Array<{
    id: string;
    title: string;
    status: MilestoneStatus;
    task_counts: Record<ProjectTaskStatus, number>;
    gate_ids: string[];
    failed_gate_id?: string;
    verified_revision?: string;
  }>;
  ready_tasks: TaskSummary[];
  active_tasks: TaskSummary[];
  running_evidence: Array<{
    owner_type: EvidenceOwnerType;
    owner_id: string;
    requirement_id: string;
    proves: string;
    command: string[];
    started_at: string;
    elapsed_ms: number;
    timeout_ms: number;
    timeout_remaining_ms: number;
    sequence_position: number;
    sequence_total: number;
    completed_in_sequence: number;
    log_size_bytes: number;
    activity: "starting" | "active" | "quiet";
    last_output_at?: string;
    quiet_for_ms: number;
    status_message: string;
    recent_output?: string;
    log_path: string;
  }>;
  next_action: string;
  path: string;
}

export interface TaskHandle {
  project_id: string;
  task_id: string;
  owner_id: string;
  worktree: string;
  implementation_tier: ImplementationTier;
  implementation_agent: string;
}

export interface TaskContext {
  handle: TaskHandle;
  contract: {
    title: string;
    kind: ProjectTaskKind;
    tier_rationale: string;
    depends_on: string[];
    allowed_paths: string[];
    excluded_paths: string[];
    acceptance_criteria: string[];
    required_evidence: EvidenceRequirement[];
    gate_binding?: GateBinding;
  };
  instructions: string[];
}

export interface CompletionResult {
  manifest: ProjectStatusReport;
  task_id: string;
  result: "merged" | "evidence-running" | "evidence-failed";
  evidence: EvidenceAttempt[];
  running_evidence?: ProjectStatusReport["running_evidence"];
  poll_token?: string;
}

export interface VerifyNextResult {
  manifest: ProjectStatusReport;
  owner_type: "preflight" | "milestone";
  owner_id: string;
  result: "running" | "pass" | "fail" | "nothing-to-run";
  evidence?: EvidenceAttempt;
  running_evidence?: ProjectStatusReport["running_evidence"][number];
  poll_token?: string;
}

const PROJECTS_DIR = ".projects";
const MANIFEST = "project.json";
const PROJECT_ID = /^(\d{4})-([a-z0-9-]+)$/;
const ITEM_ID = /^[a-z][a-z0-9-]*$/;
const MAX_TIMEOUT_MS = 1_800_000;
const now = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

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

function currentBranch(base: string): string {
  return run(base, ["branch", "--show-current"]);
}

function branchExists(base: string, branch: string): boolean {
  try {
    revision(base, branch);
    return true;
  } catch {
    return false;
  }
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

function displayTitle(value: string): string {
  return value.trim().split(/\s+/)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function projectsRoot(base: string): string {
  return join(base, PROJECTS_DIR);
}

function projectFolder(base: string, id: string): string {
  return join(projectsRoot(base), id);
}

function manifestPath(base: string, id: string): string {
  return join(projectFolder(base, id), MANIFEST);
}

function ensureProjectsRoot(base: string): void {
  mkdirSync(projectsRoot(base), { recursive: true });
  const ignore = join(projectsRoot(base), ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "**\n!.gitignore\n");
}

function writeManifest(base: string, manifest: ProjectManifest): void {
  manifest.updated_at = now();
  mkdirSync(projectFolder(base, manifest.id), { recursive: true });
  writeFileSync(manifestPath(base, manifest.id), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function readProjectManifest(base: string, id: string): ProjectManifest {
  const file = manifestPath(base, id);
  if (!existsSync(file)) throw new Error(`Project not found: ${id}`);
  const value = JSON.parse(readFileSync(file, "utf8")) as { schema_version?: number };
  if (value.schema_version !== 4) {
    throw new Error(
      `Project ${id} uses unsupported schema ${value.schema_version ?? "unknown"}; ` +
        "schema-v4 projects must be created afresh.",
    );
  }
  return value as ProjectManifest;
}

function matches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("?", "[^/]")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function changed(base: string, from: string, to = "HEAD"): string[] {
  const output = run(base, ["diff", "--name-only", `${from}...${to}`]);
  return output ? output.split("\n").map((item) => item.trim()).filter(Boolean) : [];
}

function workingTreeChanges(base: string): string[] {
  const output = run(base, ["status", "--porcelain", "--untracked-files=all"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function integrationChanges(base: string): string[] {
  return workingTreeChanges(base).filter((line) =>
    !line.endsWith(" .projects/.gitignore") && !line.includes(" .projects/")
  );
}

function assertIntegrationReady(base: string, manifest: ProjectManifest): void {
  const current = currentBranch(base);
  if (current !== manifest.integration_branch) {
    throw new Error(
      `Operation requires ${manifest.integration_branch}; current branch is ${current || "(detached)"}.`,
    );
  }
  const dirty = integrationChanges(base);
  if (dirty.length) {
    throw new Error(`Integration worktree is not clean:\n${dirty.join("\n")}`);
  }
}

function milestone(manifest: ProjectManifest, milestoneId: string): ProjectMilestone {
  const item = manifest.milestones.find((candidate) => candidate.id === milestoneId);
  if (!item) throw new Error(`Project milestone not found: ${milestoneId}`);
  return item;
}

function allTasks(manifest: ProjectManifest): Array<{
  ownerType: "preflight" | "milestone";
  ownerId: string;
  milestone?: ProjectMilestone;
  task: ProjectTask;
}> {
  return [
    ...manifest.preflight.repairs.map((task) => ({
      ownerType: "preflight" as const,
      ownerId: "preflight",
      task,
    })),
    ...manifest.milestones.flatMap((owner) =>
      owner.tasks.map((task) => ({
        ownerType: "milestone" as const,
        ownerId: owner.id,
        milestone: owner,
        task,
      }))
    ),
  ];
}

function locateTask(manifest: ProjectManifest, taskId: string): ReturnType<typeof allTasks>[number] {
  const located = allTasks(manifest).find((item) => item.task.id === taskId);
  if (!located) throw new Error(`Project task not found: ${taskId}`);
  return located;
}

function implementationAgent(tier: ImplementationTier): string {
  return `implement-${tier}`;
}

function taskSummary(
  ownerId: string,
  task: ProjectTask,
): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    status: task.status,
    owner_id: ownerId,
    implementation_tier: task.implementation_tier,
    implementation_agent: implementationAgent(task.implementation_tier),
    ...(task.attempt ? { attempt: task.attempt } : {}),
  };
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

function taskDependenciesMet(owner: ProjectMilestone | undefined, task: ProjectTask): boolean {
  if (!owner) return true;
  return task.depends_on.every((dependency) =>
    owner.tasks.find((candidate) => candidate.id === dependency)?.status === "merged"
  );
}

function milestoneDependenciesMet(
  manifest: ProjectManifest,
  item: ProjectMilestone,
): boolean {
  return item.depends_on.every((dependency) =>
    milestone(manifest, dependency).status === "verified"
  );
}

function activateAvailableMilestones(manifest: ProjectManifest): void {
  if (
    !["passed", "excepted"].includes(manifest.preflight.status) ||
    manifest.status === "done"
  ) return;
  for (const item of manifest.milestones) {
    if (item.status === "verified" || item.status === "repairing") continue;
    if (!milestoneDependenciesMet(manifest, item)) {
      item.status = "pending";
      continue;
    }
    item.status = item.tasks.every((task) => task.status === "merged")
      ? "verifying"
      : "active";
  }
  if (manifest.milestones.every((item) => item.status === "verified")) {
    manifest.status = "done";
  } else if (manifest.status !== "blocked") {
    manifest.status = "active";
  }
}

function ownerScopedRequirement(
  requirements: EvidenceRequirement[],
  requirementId: string,
): EvidenceRequirement {
  const requirement = requirements.find((item) => item.id === requirementId);
  if (!requirement) throw new Error(`Evidence requirement not found: ${requirementId}`);
  return requirement;
}

function latestAttempt(
  manifest: ProjectManifest,
  ownerType: EvidenceOwnerType,
  ownerId: string,
  requirementId: string,
): EvidenceAttempt | undefined {
  return manifest.evidence.filter((attempt) =>
    attempt.owner_type === ownerType &&
    attempt.owner_id === ownerId &&
    attempt.requirement_id === requirementId
  ).at(-1);
}

function freshPass(
  manifest: ProjectManifest,
  ownerType: EvidenceOwnerType,
  ownerId: string,
  requirement: EvidenceRequirement,
  expectedRevision: string,
): boolean {
  const attempt = latestAttempt(manifest, ownerType, ownerId, requirement.id);
  return attempt?.result === "pass" &&
    attempt.level === requirement.level &&
    attempt.revision === expectedRevision;
}

function safeEvidenceCommand(requirement: EvidenceRequirement): void {
  const executable = requirement.command[0]!.split("/").at(-1)?.toLowerCase();
  const args = requirement.command.slice(1);
  const unsafeGit = executable === "git" &&
    (["reset", "clean", "restore"].includes(args[0] ?? "") ||
      (args[0] === "checkout" && args[1] === "--") ||
      (args[0] === "push" &&
        args.some((arg) => arg === "-f" || arg.startsWith("--force"))));
  if (
    ["rm", "sudo", "sh", "bash", "zsh", "fish"].includes(executable ?? "") ||
    unsafeGit
  ) {
    throw new Error(`Unsafe evidence command is not allowed: ${requirement.id}`);
  }
}

function diagnosticText(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function failureFingerprint(
  requirement: EvidenceRequirement,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  diagnostic: string,
): string {
  const stableDiagnostic = diagnostic
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, "<timestamp>")
    .replace(/\s+/g, " ")
    .slice(-8_000);
  return hash(JSON.stringify({
    executable: requirement.command[0],
    exitCode,
    signal,
    diagnostic: stableDiagnostic,
  })).slice(0, 24);
}

function logPath(
  base: string,
  manifest: ProjectManifest,
  ownerType: EvidenceOwnerType,
  ownerId: string,
  requirementId: string,
  attempt: number,
): { absolute: string; stored: string } {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9.-]+/g, "-");
  const ordinal = manifest.evidence.length + (manifest.active_evidence?.length ?? 0) + 1;
  const name = `${String(ordinal).padStart(4, "0")}-` +
    `${safe(ownerType)}-${safe(ownerId)}-${safe(requirementId)}-${attempt}.log`;
  const absolute = join(projectFolder(base, manifest.id), "logs", name);
  return { absolute, stored: relative(base, absolute) };
}

interface EvidenceRunnerResult {
  completed_at: string;
  duration_ms: number;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  timed_out: boolean;
  error?: string;
}

function activeEvidence(manifest: ProjectManifest): EvidenceRun[] {
  manifest.active_evidence ??= [];
  return manifest.active_evidence;
}

function tail(path: string, bytes = 8_000): string {
  if (!existsSync(path)) return "";
  const descriptor = openSync(path, "r");
  try {
    const size = fstatSync(descriptor).size;
    const length = Math.min(bytes, size);
    const buffer = Buffer.alloc(length);
    readSync(descriptor, buffer, 0, length, size - length);
    return diagnosticText(buffer.toString("utf8"));
  } finally {
    closeSync(descriptor);
  }
}

function requirementSequence(
  manifest: ProjectManifest,
  ownerType: EvidenceOwnerType,
  ownerId: string,
  requirement: EvidenceRequirement,
): EvidenceRequirement[] {
  if (ownerType === "preflight" && ownerId === "preflight") {
    return manifest.preflight.required_evidence;
  }
  if (ownerType === "milestone" && !ownerId.startsWith("repair:")) {
    return milestone(manifest, ownerId).required_evidence;
  }
  if (ownerType === "task") {
    return locateTask(manifest, ownerId).task.required_evidence;
  }
  return [requirement];
}

function requirementForRun(
  manifest: ProjectManifest,
  item: EvidenceRun,
): EvidenceRequirement {
  if (item.owner_type === "preflight" && item.owner_id === "preflight") {
    return ownerScopedRequirement(
      manifest.preflight.required_evidence,
      item.requirement_id,
    );
  }
  if (item.owner_type === "milestone" && !item.owner_id.startsWith("repair:")) {
    return ownerScopedRequirement(
      milestone(manifest, item.owner_id).required_evidence,
      item.requirement_id,
    );
  }
  const taskId = item.owner_id.startsWith("repair:")
    ? item.owner_id.slice("repair:".length)
    : item.owner_id;
  const task = locateTask(manifest, taskId).task;
  if (item.owner_type === "task") {
    return ownerScopedRequirement(task.required_evidence, item.requirement_id);
  }
  if (!task.gate_binding) {
    throw new Error(`Repair evidence has no gate binding: ${taskId}`);
  }
  const requirements = task.gate_binding.owner_type === "preflight"
    ? manifest.preflight.required_evidence
    : milestone(manifest, task.gate_binding.owner_id).required_evidence;
  return ownerScopedRequirement(requirements, item.requirement_id);
}

function runningEvidenceSummary(
  base: string,
  manifest: ProjectManifest,
  item: EvidenceRun,
): ProjectStatusReport["running_evidence"][number] {
  const requirement = requirementForRun(manifest, item);
  const sequence = requirementSequence(
    manifest,
    item.owner_type,
    item.owner_id,
    requirement,
  );
  const log = join(base, item.log_path);
  const elapsed = Math.max(0, Date.now() - Date.parse(item.started_at));
  const recentOutput = tail(log, 1_500);
  const logStats = existsSync(log) ? statSync(log) : undefined;
  const quietFor = logStats
    ? Math.max(0, Date.now() - logStats.mtimeMs)
    : elapsed;
  const completed = manifest.evidence.filter((attempt) =>
    attempt.owner_type === item.owner_type &&
    attempt.owner_id === item.owner_id &&
    attempt.revision === item.revision &&
    attempt.result === "pass"
  ).length;
  const inferredIndex = sequence.findIndex((entry) => entry.id === item.requirement_id);
  const position = item.sequence_position ?? Math.max(0, inferredIndex) + 1;
  const total = item.sequence_total ?? sequence.length;
  const proves = item.proves ?? requirement.proves;
  const scope = item.owner_type === "preflight"
    ? "preflight"
    : item.owner_type === "milestone"
    ? `milestone ${item.owner_id}`
    : `task ${item.owner_id}`;
  const activity = !logStats?.size
    ? "starting"
    : quietFor > 30_000
    ? "quiet"
    : "active";
  const quietSuffix = activity === "quiet"
    ? `; no new output for ${Math.round(quietFor / 1_000)}s`
    : "";
  return {
    owner_type: item.owner_type,
    owner_id: item.owner_id,
    requirement_id: item.requirement_id,
    proves,
    command: [...item.command],
    started_at: item.started_at,
    elapsed_ms: elapsed,
    timeout_ms: item.timeout_ms,
    timeout_remaining_ms: Math.max(0, item.timeout_ms - elapsed),
    sequence_position: position,
    sequence_total: total,
    completed_in_sequence: Math.min(completed, total),
    log_size_bytes: logStats?.size ?? 0,
    activity,
    ...(logStats ? { last_output_at: logStats.mtime.toISOString() } : {}),
    quiet_for_ms: quietFor,
    status_message:
      `Running ${scope} check ${position}/${total}: ${proves} ` +
      `(${Math.round(elapsed / 1_000)}s elapsed${quietSuffix})`,
    ...(recentOutput ? { recent_output: recentOutput } : {}),
    log_path: item.log_path,
  };
}

function runnerAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startRequirement(
  base: string,
  manifest: ProjectManifest,
  cwd: string,
  ownerType: EvidenceOwnerType,
  ownerId: string,
  requirement: EvidenceRequirement,
): EvidenceRun {
  safeEvidenceCommand(requirement);
  const dirty = cwd === base ? integrationChanges(base) : workingTreeChanges(cwd);
  if (dirty.length) {
    throw new Error(`Evidence requires a clean worktree: ${requirement.id}`);
  }
  const running = activeEvidence(manifest);
  const duplicate = running.find((item) =>
    item.owner_type === ownerType &&
    item.owner_id === ownerId &&
    item.requirement_id === requirement.id
  );
  if (duplicate) return duplicate;
  const previous = [
    ...manifest.evidence,
    ...running,
  ].filter((attempt) =>
    attempt.owner_type === ownerType &&
    attempt.owner_id === ownerId &&
    attempt.requirement_id === requirement.id
  ).length;
  const attemptNumber = previous + 1;
  const timeout = requirement.timeout_ms ??
    (requirement.level === "task" ? 300_000 : 900_000);
  const sequence = requirementSequence(
    manifest,
    ownerType,
    ownerId,
    requirement,
  );
  const sequenceIndex = sequence.findIndex((item) => item.id === requirement.id);
  const startedAt = now();
  const currentRevision = revision(cwd);
  const id = `${Date.now()}-${hash([
    manifest.id,
    ownerType,
    ownerId,
    requirement.id,
    currentRevision,
  ].join(":")).slice(0, 12)}`;
  const path = logPath(base, manifest, ownerType, ownerId, requirement.id, attemptNumber);
  const runsFolder = join(projectFolder(base, manifest.id), "runs");
  const specPath = join(runsFolder, `${id}.json`);
  const resultPath = join(runsFolder, `${id}.result.json`);
  mkdirSync(dirname(path.absolute), { recursive: true });
  mkdirSync(runsFolder, { recursive: true });
  writeFileSync(path.absolute, "");
  writeFileSync(specPath, `${JSON.stringify({
    command: requirement.command,
    cwd,
    timeout_ms: timeout,
    log_path: path.absolute,
    result_path: resultPath,
  }, null, 2)}\n`);
  const runner = spawn("bun", [join(import.meta.dir, "evidence-runner.ts"), specPath], {
    cwd: base,
    detached: true,
    stdio: "ignore",
  });
  runner.once("error", (error) => {
    appendFileSync(path.absolute, `\n[evidence-runner] launch error: ${error.message}\n`);
    if (!existsSync(resultPath)) {
      writeFileSync(resultPath, `${JSON.stringify({
        completed_at: now(),
        duration_ms: Date.now() - Date.parse(startedAt),
        exit_code: null,
        signal: null,
        timed_out: false,
        error: error.message,
      }, null, 2)}\n`);
    }
  });
  runner.unref();
  const runRecord: EvidenceRun = {
    id,
    requirement_id: requirement.id,
    owner_type: ownerType,
    owner_id: ownerId,
    level: requirement.level,
    command: [...requirement.command],
    started_at: startedAt,
    timeout_ms: timeout,
    revision: currentRevision,
    log_path: path.stored,
    result_path: relative(base, resultPath),
    runner_pid: runner.pid ?? -1,
    proves: requirement.proves,
    sequence_position: Math.max(0, sequenceIndex) + 1,
    sequence_total: sequence.length,
  };
  running.push(runRecord);
  writeManifest(base, manifest);
  return runRecord;
}

function pollRequirement(
  base: string,
  manifest: ProjectManifest,
  runRecord: EvidenceRun,
): EvidenceAttempt | undefined {
  const resultPath = join(base, runRecord.result_path);
  if (!existsSync(resultPath)) {
    const overdue = Date.now() - Date.parse(runRecord.started_at) >
      runRecord.timeout_ms + 15_000;
    if (!overdue || runnerAlive(runRecord.runner_pid)) return undefined;
    writeFileSync(resultPath, `${JSON.stringify({
      completed_at: now(),
      duration_ms: Date.now() - Date.parse(runRecord.started_at),
      exit_code: null,
      signal: null,
      timed_out: true,
      error: "Evidence runner exited without recording a result",
    }, null, 2)}\n`);
  }
  const result = JSON.parse(readFileSync(resultPath, "utf8")) as EvidenceRunnerResult;
  const diagnostic = tail(join(base, runRecord.log_path));
  const passed = result.exit_code === 0 && !result.timed_out && !result.error;
  const attemptNumber = manifest.evidence.filter((attempt) =>
    attempt.owner_type === runRecord.owner_type &&
    attempt.owner_id === runRecord.owner_id &&
    attempt.requirement_id === runRecord.requirement_id
  ).length + 1;
  const requirement: EvidenceRequirement = {
    id: runRecord.requirement_id,
    level: runRecord.level,
    command: runRecord.command,
    proves: "",
    timeout_ms: runRecord.timeout_ms,
  };
  const attempt: EvidenceAttempt = {
    requirement_id: runRecord.requirement_id,
    owner_type: runRecord.owner_type,
    owner_id: runRecord.owner_id,
    level: runRecord.level,
    attempt: attemptNumber,
    result: passed ? "pass" : "fail",
    checked_at: result.completed_at,
    duration_ms: result.duration_ms,
    exit_code: result.exit_code,
    revision: runRecord.revision,
    log_path: runRecord.log_path,
    ...(!passed
      ? {
        failure_fingerprint: failureFingerprint(
          requirement,
          result.exit_code,
          result.signal,
          diagnostic,
        ),
        diagnostic_tail: (
          diagnostic ||
          result.error ||
          (result.timed_out ? "evidence command timed out" : "command failed without output")
        ).slice(-8_000),
      }
      : {}),
  };
  manifest.evidence.push(attempt);
  manifest.active_evidence = activeEvidence(manifest)
    .filter((item) => item.id !== runRecord.id);
  return attempt;
}

function validateRequirement(
  requirement: EvidenceRequirement,
  expectedLevel: EvidenceLevel,
  ownerEvidenceIds: Set<string>,
): void {
  if (
    requirement.level !== expectedLevel ||
    !ITEM_ID.test(requirement.id) ||
    ownerEvidenceIds.has(requirement.id) ||
    !requirement.command.length ||
    requirement.command.some((part) => typeof part !== "string" || !part.trim()) ||
    !requirement.proves.trim()
  ) {
    throw new Error(
      `Evidence must be complete, owner-unique, and ${expectedLevel}-scoped: ${requirement.id}`,
    );
  }
  if (
    requirement.timeout_ms !== undefined &&
    (!Number.isFinite(requirement.timeout_ms) ||
      requirement.timeout_ms <= 0 ||
      requirement.timeout_ms > MAX_TIMEOUT_MS)
  ) {
    throw new Error(
      `Evidence timeout must be between 1 and ${MAX_TIMEOUT_MS}ms: ${requirement.id}`,
    );
  }
  ownerEvidenceIds.add(requirement.id);
}

function validateTask(
  task: ProjectTaskInput,
  globalTaskIds: Set<string>,
  expectedKind?: ProjectTaskKind,
): void {
  if (!ITEM_ID.test(task.id) || globalTaskIds.has(task.id)) {
    throw new Error(`Task IDs must be globally unique kebab-case: ${task.id}`);
  }
  globalTaskIds.add(task.id);
  if (
    !task.title.trim() ||
    !task.allowed_paths.length ||
    task.allowed_paths.some((path) => !path.trim() || path.startsWith("/")) ||
    !task.acceptance_criteria.length ||
    !task.required_evidence.length ||
    !["s", "m", "l"].includes(task.implementation_tier) ||
    !task.tier_rationale.trim() ||
    !["normal", "gate-repair"].includes(task.kind) ||
    (expectedKind && task.kind !== expectedKind)
  ) {
    throw new Error(`Task contract is incomplete or invalid: ${task.id}`);
  }
  for (const path of task.excluded_paths ?? []) {
    if (!path.trim() || path.startsWith("/")) {
      throw new Error(`Task exclusions must be repository-relative: ${task.id}`);
    }
  }
  const evidenceIds = new Set<string>();
  for (const requirement of task.required_evidence) {
    validateRequirement(requirement, "task", evidenceIds);
  }
}

function assertAcyclic(items: Array<{ id: string; depends_on: string[] }>, label: string): void {
  const byId = new Map(items.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`${label} dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of items) visit(item.id);
}

function validatePlan(
  preflight: EvidenceRequirement[],
  milestones: ProjectMilestoneInput[],
): void {
  if (!milestones.length) throw new Error("A project plan requires at least one milestone");
  const preflightIds = new Set<string>();
  for (const requirement of preflight) {
    validateRequirement(requirement, "preflight", preflightIds);
  }
  const milestoneIds = new Set<string>();
  const globalTaskIds = new Set<string>();
  for (const item of milestones) {
    if (!ITEM_ID.test(item.id) || milestoneIds.has(item.id)) {
      throw new Error(`Milestone IDs must be unique kebab-case: ${item.id}`);
    }
    milestoneIds.add(item.id);
    if (
      !item.title.trim() ||
      !item.acceptance_criteria.length ||
      !item.required_evidence.length
    ) {
      throw new Error(`Milestone ${item.id} needs a title, acceptance criteria, and gates`);
    }
    const evidenceIds = new Set<string>();
    for (const requirement of item.required_evidence) {
      validateRequirement(requirement, "milestone", evidenceIds);
    }
    const localTaskIds = new Set<string>();
    for (const task of item.tasks) {
      validateTask(task, globalTaskIds, "normal");
      localTaskIds.add(task.id);
    }
    for (const task of item.tasks) {
      if (task.depends_on.some((dependency) =>
        dependency === task.id || !localTaskIds.has(dependency)
      )) {
        throw new Error(`Task ${task.id} has a dependency outside milestone ${item.id}`);
      }
    }
    assertAcyclic(item.tasks, "Task");
  }
  for (const item of milestones) {
    if (item.depends_on.some((dependency) =>
      dependency === item.id || !milestoneIds.has(dependency)
    )) {
      throw new Error(`Milestone ${item.id} has an invalid dependency`);
    }
  }
  assertAcyclic(milestones, "Milestone");
}

function normalizeTask(task: ProjectTaskInput): ProjectTask {
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    status: "ready",
    implementation_tier: task.implementation_tier,
    tier_rationale: task.tier_rationale,
    depends_on: [...task.depends_on],
    allowed_paths: [...task.allowed_paths],
    ...(task.excluded_paths?.length ? { excluded_paths: [...task.excluded_paths] } : {}),
    acceptance_criteria: [...task.acceptance_criteria],
    required_evidence: task.required_evidence.map((item) => ({
      ...item,
      command: [...item.command],
    })),
  };
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

function scopeViolations(task: ProjectTask, paths: string[]): string[] {
  return paths.filter((path) =>
    task.excluded_paths?.some((pattern) => matches(path, pattern)) ||
    !task.allowed_paths.some((pattern) => matches(path, pattern))
  );
}

function readyTaskEntries(manifest: ProjectManifest): TaskSummary[] {
  const active = allTasks(manifest).filter((item) => item.task.status === "running");
  return allTasks(manifest).filter((item) => {
    if (item.task.status !== "ready") return false;
    if (item.ownerType === "preflight" && manifest.preflight.status !== "repairing") return false;
    if (item.ownerType === "milestone" && item.milestone?.status !== "active" &&
      item.milestone?.status !== "repairing") return false;
    return taskDependenciesMet(item.milestone, item.task) &&
      !active.some((other) => overlappingWrites(item.task, other.task));
  }).map((item) => taskSummary(item.ownerId, item.task));
}

function nextAction(base: string, manifest: ProjectManifest): string {
  if (manifest.status === "design") return "Obtain explicit plan approval, then store the plan.";
  if (manifest.status === "done") return "Project complete.";
  const evidence = activeEvidence(manifest);
  if (evidence.length) {
    const current = runningEvidenceSummary(base, manifest, evidence[0]!);
    const additional = evidence.length > 1
      ? ` (${evidence.length - 1} additional task check(s) are also running.)`
      : "";
    return `${current.status_message}.${additional} ` +
      "Report the progress to the user, then poll the owning completion or verification tool.";
  }
  if (manifest.preflight.status === "failed") {
    return "Ask the user to choose baseline repair or an approved exception.";
  }
  const active = allTasks(manifest).filter((item) => item.task.status === "running");
  if (active.length) {
    return `Continue active task ${active[0]!.task.id} in its existing worktree.`;
  }
  const ready = readyTaskEntries(manifest);
  if (ready.length) {
    return `Dispatch ${ready.map((item) => item.id).join(", ")}.`;
  }
  if (manifest.preflight.status === "pending" || manifest.preflight.status === "verifying") {
    return "Run the next preflight check.";
  }
  const repairing = manifest.milestones.find((item) => item.status === "repairing");
  if (repairing) {
    return repairing.tasks.some((task) => task.kind === "gate-repair" && task.status !== "merged")
      ? `Continue the gate repair for ${repairing.id}.`
      : `Diagnose failed gate ${repairing.failed_gate_id} before creating a repair contract.`;
  }
  const verifying = manifest.milestones.find((item) => item.status === "verifying");
  if (verifying) return `Run the next gate for ${verifying.id}.`;
  return "Inspect project state.";
}

export function summarizeProject(
  base: string,
  manifest: ProjectManifest,
): ProjectStatusReport {
  const counts = (): Record<ProjectTaskStatus, number> => ({
    ready: 0,
    running: 0,
    merged: 0,
    blocked: 0,
  });
  return {
    id: manifest.id,
    title: manifest.title,
    status: manifest.status,
    integration_branch: manifest.integration_branch,
    current_branch: currentBranch(base),
    on_integration_branch: currentBranch(base) === manifest.integration_branch,
    preflight: {
      status: manifest.preflight.status,
      evidence_ids: manifest.preflight.required_evidence.map((item) => item.id),
      ...(manifest.preflight.failed_requirement_id
        ? { failed_requirement_id: manifest.preflight.failed_requirement_id }
        : {}),
    },
    milestones: manifest.milestones.map((item) => {
      const taskCounts = counts();
      for (const task of item.tasks) taskCounts[task.status] += 1;
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        task_counts: taskCounts,
        gate_ids: item.required_evidence.map((gate) => gate.id),
        ...(item.failed_gate_id ? { failed_gate_id: item.failed_gate_id } : {}),
        ...(item.verified_revision ? { verified_revision: item.verified_revision } : {}),
      };
    }),
    ready_tasks: readyTaskEntries(manifest),
    active_tasks: allTasks(manifest)
      .filter((item) => item.task.status === "running")
      .map((item) => taskSummary(item.ownerId, item.task)),
    running_evidence: activeEvidence(manifest)
      .map((item) => runningEvidenceSummary(base, manifest, item)),
    next_action: nextAction(base, manifest),
    path: manifestPath(base, manifest.id),
  };
}

export function createProject(base: string, name: string): ProjectManifest {
  const projectSlug = slug(name);
  if (!projectSlug) throw new Error("Project name must contain letters or numbers");
  if (integrationChanges(base).length) {
    throw new Error("Create a project from a clean integration checkout");
  }
  ensureProjectsRoot(base);
  const numbers = readdirSync(projectsRoot(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PROJECT_ID.test(entry.name))
    .map((entry) => Number(PROJECT_ID.exec(entry.name)![1]));
  const id = `${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}-${projectSlug}`;
  const branch = `project/${id}`;
  if (branchExists(base, branch)) throw new Error(`Project branch already exists: ${branch}`);
  const baseRevision = revision(base);
  run(base, ["switch", "-c", branch]);
  const createdAt = now();
  const manifest: ProjectManifest = {
    schema_version: 4,
    id,
    title: displayTitle(name),
    status: "design",
    created_at: createdAt,
    updated_at: createdAt,
    integration_branch: branch,
    integration_base: baseRevision,
    preflight: {
      status: "pending",
      required_evidence: [],
      repairs: [],
    },
    milestones: [],
    evidence: [],
    decisions: [],
  };
  writeManifest(base, manifest);
  return manifest;
}

export function resolveProject(base: string, value: string): string {
  const exact = value.trim();
  if (existsSync(manifestPath(base, exact))) return exact;
  ensureProjectsRoot(base);
  const candidates = readdirSync(projectsRoot(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PROJECT_ID.test(entry.name))
    .map((entry) => entry.name)
    .filter((id) => id.startsWith(`${exact.padStart(4, "0")}-`) || id === exact);
  if (candidates.length === 1) return candidates[0]!;
  if (!candidates.length) throw new Error(`Project not found: ${value}`);
  throw new Error(`Project reference is ambiguous: ${value}`);
}

export function listProjects(base: string): ProjectStatusReport[] {
  ensureProjectsRoot(base);
  return readdirSync(projectsRoot(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PROJECT_ID.test(entry.name))
    .flatMap((entry) => {
      try {
        return [summarizeProject(base, readProjectManifest(base, entry.name))];
      } catch {
        return [];
      }
    });
}

export function readProjectStatus(base: string, id: string): ProjectStatusReport {
  return summarizeProject(base, readProjectManifest(base, id));
}

export function setProjectPlan(
  base: string,
  id: string,
  preflight: EvidenceRequirement[],
  milestones: ProjectMilestoneInput[],
): ProjectStatusReport {
  const manifest = readProjectManifest(base, id);
  if (manifest.status !== "design") throw new Error("Project plan is already active");
  assertIntegrationReady(base, manifest);
  validatePlan(preflight, milestones);
  manifest.preflight = {
    status: preflight.length ? "pending" : "passed",
    required_evidence: preflight.map((item) => ({ ...item, command: [...item.command] })),
    repairs: [],
    ...(!preflight.length ? { verified_revision: revision(base), resolved_at: now() } : {}),
  };
  manifest.milestones = milestones.map((item) => ({
    id: item.id,
    title: item.title,
    status: "pending",
    depends_on: [...item.depends_on],
    acceptance_criteria: [...item.acceptance_criteria],
    required_evidence: item.required_evidence.map((requirement) => ({
      ...requirement,
      command: [...requirement.command],
    })),
    tasks: item.tasks.map(normalizeTask),
  }));
  manifest.status = preflight.length ? "preflight" : "active";
  activateAvailableMilestones(manifest);
  writeManifest(base, manifest);
  return summarizeProject(base, manifest);
}

export function dispatchProjectTask(
  base: string,
  id: string,
  taskId: string,
): TaskHandle {
  const manifest = readProjectManifest(base, id);
  assertIntegrationReady(base, manifest);
  const located = locateTask(manifest, taskId);
  const ready = readyTaskEntries(manifest).some((task) => task.id === taskId);
  if (!ready) throw new Error(`Task is not ready or has overlapping active writes: ${taskId}`);
  const task = located.task;
  const attempt = (task.attempt ?? 0) + 1;
  const branch = `project-task/${manifest.id}/${task.id}/${attempt}`;
  if (branchExists(base, branch)) throw new Error(`Task branch already exists: ${branch}`);
  const worktree = worktreeRoot(base, manifest, task, attempt);
  mkdirSync(dirname(worktree), { recursive: true });
  run(base, ["worktree", "add", "-b", branch, worktree, manifest.integration_branch]);
  task.status = "running";
  task.attempt = attempt;
  task.branch = branch;
  task.worktree = worktree;
  task.base_revision = revision(base);
  writeManifest(base, manifest);
  return {
    project_id: manifest.id,
    task_id: task.id,
    owner_id: located.ownerId,
    worktree,
    implementation_tier: task.implementation_tier,
    implementation_agent: implementationAgent(task.implementation_tier),
  };
}

export function readProjectTaskContext(
  base: string,
  id: string,
  taskId: string,
  requestingAgent: string,
): TaskContext {
  const manifest = readProjectManifest(base, id);
  const located = locateTask(manifest, taskId);
  const task = located.task;
  const selectedAgent = implementationAgent(task.implementation_tier);
  if (requestingAgent !== selectedAgent && requestingAgent !== "orchestrate") {
    throw new Error(`Task ${taskId} is assigned to ${selectedAgent}, not ${requestingAgent}`);
  }
  if (task.status !== "running" || !task.worktree) {
    throw new Error(`Task context is available only for a dispatched task: ${taskId}`);
  }
  return {
    handle: {
      project_id: manifest.id,
      task_id: task.id,
      owner_id: located.ownerId,
      worktree: task.worktree,
      implementation_tier: task.implementation_tier,
      implementation_agent: selectedAgent,
    },
    contract: {
      title: task.title,
      kind: task.kind,
      tier_rationale: task.tier_rationale,
      depends_on: [...task.depends_on],
      allowed_paths: [...task.allowed_paths],
      excluded_paths: [...(task.excluded_paths ?? [])],
      acceptance_criteria: [...task.acceptance_criteria],
      required_evidence: task.required_evidence.map((item) => ({
        ...item,
        command: [...item.command],
      })),
      ...(task.gate_binding ? { gate_binding: { ...task.gate_binding } } : {}),
    },
    instructions: [
      "Read the repository root AGENTS.md and every applicable child AGENTS.md before editing.",
      "Perform the tier fit check before editing; return TIER_MISMATCH if the assigned tier is too small.",
      "Use only this worktree, stay within allowed paths, commit cohesive changes, and do not delegate.",
    ],
  };
}

export function escalateProjectTask(
  base: string,
  id: string,
  taskId: string,
  tier: ImplementationTier,
  rationale: string,
): TaskHandle {
  const manifest = readProjectManifest(base, id);
  const located = locateTask(manifest, taskId);
  const task = located.task;
  if (task.status !== "running" || !task.worktree) {
    throw new Error(`Only a running task can be escalated: ${taskId}`);
  }
  const order: ImplementationTier[] = ["s", "m", "l"];
  if (order.indexOf(tier) <= order.indexOf(task.implementation_tier)) {
    throw new Error(`Task tiers may only escalate upward from ${task.implementation_tier}`);
  }
  if (!rationale.trim()) throw new Error("Tier escalation requires concrete newly discovered risks");
  const previous = task.implementation_tier;
  task.implementation_tier = tier;
  task.tier_rationale = rationale;
  manifest.decisions.push({
    at: now(),
    summary: `Escalated ${taskId} from implement-${previous} to implement-${tier}`,
    rationale,
    task_id: taskId,
    ...(located.ownerType === "milestone" ? { milestone_id: located.ownerId } : {}),
  });
  writeManifest(base, manifest);
  return {
    project_id: manifest.id,
    task_id: task.id,
    owner_id: located.ownerId,
    worktree: task.worktree,
    implementation_tier: tier,
    implementation_agent: implementationAgent(tier),
  };
}

function completeMerge(
  base: string,
  manifest: ProjectManifest,
  located: ReturnType<typeof locateTask>,
  taskRevision: string,
): void {
  const task = located.task;
  assertIntegrationReady(base, manifest);
  try {
    run(base, ["merge", "--no-ff", "--no-commit", task.branch!]);
    const violations = scopeViolations(
      task,
      changed(base, task.base_revision!, "HEAD"),
    );
    if (violations.length) {
      throw new Error(`Merged task changed paths outside its contract:\n${violations.join("\n")}`);
    }
    run(base, [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      `chore(project): integrate ${task.id}`,
    ]);
  } catch (error) {
    try {
      run(base, ["merge", "--abort"]);
    } catch {
      // Preserve the original integration error.
    }
    throw error;
  }
  task.status = "merged";
  task.verified_revision = taskRevision;
  task.merged_at = now();
  const worktree = task.worktree!;
  task.worktree = undefined;
  if (located.ownerType === "preflight") {
    manifest.preflight.status = "verifying";
    manifest.status = "preflight";
  } else if (task.kind === "gate-repair") {
    located.milestone!.status = "verifying";
    manifest.status = "active";
  }
  activateAvailableMilestones(manifest);
  writeManifest(base, manifest);
  try {
    run(base, ["worktree", "remove", worktree]);
  } catch {
    // The merged state is authoritative; stale worktrees can be pruned safely later.
  }
}

export function completeProjectTask(
  base: string,
  id: string,
  taskId: string,
): CompletionResult {
  const manifest = readProjectManifest(base, id);
  const located = locateTask(manifest, taskId);
  const task = located.task;
  if (task.status !== "running" || !task.worktree || !task.base_revision || !task.branch) {
    throw new Error(`Task is not running: ${taskId}`);
  }
  if (workingTreeChanges(task.worktree).length) {
    throw new Error(`Task worktree must be clean and committed before completion: ${taskId}`);
  }
  const taskRevision = revision(task.worktree);
  if (taskRevision === task.base_revision) {
    throw new Error(`Task has no committed implementation changes: ${taskId}`);
  }
  const violations = scopeViolations(
    task,
    changed(task.worktree, task.base_revision, taskRevision),
  );
  if (violations.length) {
    throw new Error(`Task changed paths outside its contract:\n${violations.join("\n")}`);
  }
  const attempts: EvidenceAttempt[] = [];
  const belongsToTask = (runRecord: EvidenceRun): boolean =>
    (runRecord.owner_type === "task" && runRecord.owner_id === task.id) ||
    runRecord.owner_id === `repair:${task.id}`;
  for (const runRecord of activeEvidence(manifest).filter(belongsToTask)) {
    const attempt = pollRequirement(base, manifest, runRecord);
    if (attempt) attempts.push(attempt);
  }
  const stillRunning = activeEvidence(manifest).filter(belongsToTask);
  if (stillRunning.length) {
    writeManifest(base, manifest);
    const summary = summarizeProject(base, manifest);
    return {
      manifest: summary,
      task_id: task.id,
      result: "evidence-running",
      evidence: attempts,
      running_evidence: summary.running_evidence.filter((item) =>
        (item.owner_type === "task" && item.owner_id === task.id) ||
        item.owner_id === `repair:${task.id}`
      ),
      poll_token: `${stillRunning.map((item) => item.id).join(",")}:${Date.now()}`,
    };
  }
  if (attempts.some((attempt) =>
    attempt.result === "fail" && attempt.revision === taskRevision
  )) {
    writeManifest(base, manifest);
    return {
      manifest: summarizeProject(base, manifest),
      task_id: task.id,
      result: "evidence-failed",
      evidence: attempts,
    };
  }
  let started = false;
  for (const requirement of task.required_evidence) {
    if (freshPass(manifest, "task", task.id, requirement, taskRevision)) continue;
    const previous = latestAttempt(manifest, "task", task.id, requirement.id);
    if (previous?.result === "fail" && previous.revision === taskRevision) {
      attempts.push(previous);
      continue;
    }
    startRequirement(base, manifest, task.worktree, "task", task.id, requirement);
    started = true;
  }
  if (attempts.some((attempt) => attempt.result === "fail")) {
    writeManifest(base, manifest);
    return {
      manifest: summarizeProject(base, manifest),
      task_id: task.id,
      result: "evidence-failed",
      evidence: attempts,
    };
  }
  if (started) {
    writeManifest(base, manifest);
    const summary = summarizeProject(base, manifest);
    return {
      manifest: summary,
      task_id: task.id,
      result: "evidence-running",
      evidence: attempts,
      running_evidence: summary.running_evidence.filter((item) =>
        item.owner_type === "task" && item.owner_id === task.id
      ),
      poll_token: `${activeEvidence(manifest)
        .filter((item) => item.owner_type === "task" && item.owner_id === task.id)
        .map((item) => item.id).join(",")}:${Date.now()}`,
    };
  }
  if (task.gate_binding) {
    const binding = task.gate_binding;
    const requirements = binding.owner_type === "preflight"
      ? manifest.preflight.required_evidence
      : milestone(manifest, binding.owner_id).required_evidence;
    const requirement = ownerScopedRequirement(requirements, binding.requirement_id);
    const diagnosticOwner = `repair:${task.id}`;
    const previous = latestAttempt(
      manifest,
      requirement.level,
      diagnosticOwner,
      requirement.id,
    );
    if (previous?.result === "fail" && previous.revision === taskRevision) {
      attempts.push(previous);
    } else if (
      !freshPass(manifest, requirement.level, diagnosticOwner, requirement, taskRevision)
    ) {
      startRequirement(
        base,
        manifest,
        task.worktree,
        requirement.level,
        diagnosticOwner,
        requirement,
      );
      writeManifest(base, manifest);
      const summary = summarizeProject(base, manifest);
      return {
        manifest: summary,
        task_id: task.id,
        result: "evidence-running",
        evidence: attempts,
        running_evidence: summary.running_evidence.filter((item) =>
          item.owner_id === diagnosticOwner
        ),
        poll_token: `${activeEvidence(manifest)
          .find((item) => item.owner_id === diagnosticOwner)?.id}:${Date.now()}`,
      };
    }
    if (attempts.at(-1)?.result === "fail") {
      writeManifest(base, manifest);
      return {
        manifest: summarizeProject(base, manifest),
        task_id: task.id,
        result: "evidence-failed",
        evidence: attempts,
      };
    }
  }
  completeMerge(base, manifest, located, taskRevision);
  return {
    manifest: readProjectStatus(base, id),
    task_id: task.id,
    result: "merged",
    evidence: attempts,
  };
}

function firstStaleRequirement(
  manifest: ProjectManifest,
  ownerType: "preflight" | "milestone",
  ownerId: string,
  requirements: EvidenceRequirement[],
  revisionValue: string,
  priorityId?: string,
): EvidenceRequirement | undefined {
  if (priorityId) {
    const priority = ownerScopedRequirement(requirements, priorityId);
    if (!freshPass(manifest, ownerType, ownerId, priority, revisionValue)) return priority;
  }
  return requirements.find((requirement) =>
    !freshPass(manifest, ownerType, ownerId, requirement, revisionValue)
  );
}

export function verifyProjectNext(base: string, id: string): VerifyNextResult {
  const manifest = readProjectManifest(base, id);
  assertIntegrationReady(base, manifest);
  const head = revision(base);
  if (manifest.preflight.status === "pending" || manifest.preflight.status === "verifying") {
    manifest.preflight.status = "verifying";
    const running = activeEvidence(manifest).find((item) =>
      item.owner_type === "preflight" && item.owner_id === "preflight"
    );
    if (running) {
      const attempt = pollRequirement(base, manifest, running);
      if (!attempt) {
        writeManifest(base, manifest);
        const summary = summarizeProject(base, manifest);
        return {
          manifest: summary,
          owner_type: "preflight",
          owner_id: "preflight",
          result: "running",
          running_evidence: summary.running_evidence.find((item) =>
            item.owner_type === "preflight" && item.owner_id === "preflight"
          ),
          poll_token: `${running.id}:${Date.now()}`,
        };
      }
      if (attempt.result === "fail") {
        manifest.preflight.status = "failed";
        manifest.preflight.failed_requirement_id = attempt.requirement_id;
        manifest.preflight.failure_fingerprint = attempt.failure_fingerprint;
        manifest.status = "blocked";
      } else {
        manifest.preflight.failed_requirement_id = undefined;
        manifest.preflight.failure_fingerprint = undefined;
        const complete = manifest.preflight.required_evidence.every((item) =>
          freshPass(manifest, "preflight", "preflight", item, head)
        );
        if (complete) {
          manifest.preflight.status = "passed";
          manifest.preflight.verified_revision = head;
          manifest.preflight.resolved_at = now();
          manifest.status = "active";
          activateAvailableMilestones(manifest);
        }
      }
      writeManifest(base, manifest);
      return {
        manifest: summarizeProject(base, manifest),
        owner_type: "preflight",
        owner_id: "preflight",
        result: attempt.result,
        evidence: attempt,
      };
    }
    const requirement = firstStaleRequirement(
      manifest,
      "preflight",
      "preflight",
      manifest.preflight.required_evidence,
      head,
      manifest.preflight.failed_requirement_id,
    );
    if (!requirement) {
      manifest.preflight.status = "passed";
      manifest.preflight.verified_revision = head;
      manifest.preflight.resolved_at = now();
      manifest.preflight.failed_requirement_id = undefined;
      manifest.preflight.failure_fingerprint = undefined;
      manifest.status = "active";
      activateAvailableMilestones(manifest);
      writeManifest(base, manifest);
      return {
        manifest: summarizeProject(base, manifest),
        owner_type: "preflight",
        owner_id: "preflight",
        result: "nothing-to-run",
      };
    }
    const started = startRequirement(
      base,
      manifest,
      base,
      "preflight",
      "preflight",
      requirement,
    );
    writeManifest(base, manifest);
    const summary = summarizeProject(base, manifest);
    return {
      manifest: summary,
      owner_type: "preflight",
      owner_id: "preflight",
      result: "running",
      running_evidence: summary.running_evidence.find((item) =>
        item.requirement_id === started.requirement_id &&
        item.owner_type === "preflight"
      ),
      poll_token: `${started.id}:${Date.now()}`,
    };
  }
  const item = manifest.milestones.find((candidate) => candidate.status === "verifying");
  if (!item) {
    throw new Error("No preflight check or milestone gate is ready");
  }
  const running = activeEvidence(manifest).find((entry) =>
    entry.owner_type === "milestone" && entry.owner_id === item.id
  );
  if (running) {
    const attempt = pollRequirement(base, manifest, running);
    if (!attempt) {
      writeManifest(base, manifest);
      const summary = summarizeProject(base, manifest);
      return {
        manifest: summary,
        owner_type: "milestone",
        owner_id: item.id,
        result: "running",
        running_evidence: summary.running_evidence.find((entry) =>
          entry.owner_type === "milestone" && entry.owner_id === item.id
        ),
        poll_token: `${running.id}:${Date.now()}`,
      };
    }
    if (attempt.result === "fail") {
      item.status = "repairing";
      item.failed_gate_id = attempt.requirement_id;
      item.failure_fingerprint = attempt.failure_fingerprint;
      manifest.status = "blocked";
    } else {
      if (item.failed_gate_id === attempt.requirement_id) {
        item.failed_gate_id = undefined;
        item.failure_fingerprint = undefined;
      }
      const complete = item.required_evidence.every((gate) =>
        freshPass(manifest, "milestone", item.id, gate, head)
      );
      if (complete) {
        item.status = "verified";
        item.verified_revision = head;
        item.verified_at = now();
        activateAvailableMilestones(manifest);
      }
    }
    writeManifest(base, manifest);
    return {
      manifest: summarizeProject(base, manifest),
      owner_type: "milestone",
      owner_id: item.id,
      result: attempt.result,
      evidence: attempt,
    };
  }
  const requirement = firstStaleRequirement(
    manifest,
    "milestone",
    item.id,
    item.required_evidence,
    head,
    item.failed_gate_id,
  );
  if (!requirement) {
    item.status = "verified";
    item.verified_revision = head;
    item.verified_at = now();
    item.failed_gate_id = undefined;
    item.failure_fingerprint = undefined;
    activateAvailableMilestones(manifest);
    writeManifest(base, manifest);
    return {
      manifest: summarizeProject(base, manifest),
      owner_type: "milestone",
      owner_id: item.id,
      result: "nothing-to-run",
    };
  }
  const started = startRequirement(
    base,
    manifest,
    base,
    "milestone",
    item.id,
    requirement,
  );
  writeManifest(base, manifest);
  const summary = summarizeProject(base, manifest);
  return {
    manifest: summary,
    owner_type: "milestone",
    owner_id: item.id,
    result: "running",
    running_evidence: summary.running_evidence.find((entry) =>
      entry.requirement_id === started.requirement_id &&
      entry.owner_type === "milestone" &&
      entry.owner_id === item.id
    ),
    poll_token: `${started.id}:${Date.now()}`,
  };
}

function validateRepairContract(
  manifest: ProjectManifest,
  task: ProjectTaskInput,
  replacingTaskId?: string,
): void {
  const existingIds = new Set(
    allTasks(manifest)
      .map((item) => item.task.id)
      .filter((id) => id !== replacingTaskId),
  );
  validateTask(task, existingIds, "gate-repair");
  if (task.depends_on.length) {
    throw new Error("Gate-repair tasks do not declare task dependencies");
  }
}

export function resolveProjectPreflight(
  base: string,
  id: string,
  action: "repair" | "exception",
  rationale: string,
  repair?: ProjectTaskInput,
): ProjectStatusReport {
  const manifest = readProjectManifest(base, id);
  if (manifest.preflight.status !== "failed" || !manifest.preflight.failed_requirement_id) {
    throw new Error("Preflight is not awaiting an explicit resolution");
  }
  if (!rationale.trim()) throw new Error("Preflight resolution requires a rationale");
  if (action === "exception") {
    manifest.preflight.status = "excepted";
    manifest.preflight.exception_rationale = rationale;
    manifest.preflight.resolved_at = now();
    manifest.preflight.verified_revision = revision(base);
    manifest.decisions.push({
      at: now(),
      summary: `Approved preflight exception for ${manifest.preflight.failed_requirement_id}`,
      rationale,
    });
    manifest.status = "active";
    activateAvailableMilestones(manifest);
  } else {
    if (!repair) throw new Error("Baseline repair choice requires a gate-repair contract");
    validateRepairContract(manifest, repair);
    const task = normalizeTask(repair);
    task.gate_binding = {
      owner_type: "preflight",
      owner_id: "preflight",
      requirement_id: manifest.preflight.failed_requirement_id,
    };
    manifest.preflight.repairs.push(task);
    manifest.preflight.status = "repairing";
    manifest.status = "active";
    manifest.decisions.push({
      at: now(),
      summary: "Repair the failing integration baseline",
      rationale,
      task_id: task.id,
    });
  }
  writeManifest(base, manifest);
  return summarizeProject(base, manifest);
}

export function createGateRepair(
  base: string,
  id: string,
  milestoneId: string,
  repair: ProjectTaskInput,
  diagnosis: string,
): ProjectStatusReport {
  const manifest = readProjectManifest(base, id);
  const item = milestone(manifest, milestoneId);
  const hasOpenRepair = item.tasks.some((task) =>
    task.kind === "gate-repair" && task.status !== "merged"
  );
  if (
    !item.failed_gate_id ||
    (item.status !== "repairing" && !(item.status === "active" && hasOpenRepair))
  ) {
    throw new Error(`Milestone ${milestoneId} has no diagnosed failed gate`);
  }
  if (!diagnosis.trim()) {
    throw new Error("A concrete diagnosis is required before creating a repair contract");
  }
  const existing = item.tasks.find((task) =>
    task.kind === "gate-repair" &&
    task.gate_binding?.requirement_id === item.failed_gate_id &&
    task.status !== "merged"
  );
  if (existing && existing.id !== repair.id) {
    throw new Error(
      `Reuse gate-repair task ${existing.id}; do not create ${repair.id} for the same failure`,
    );
  }
  validateRepairContract(manifest, repair, existing?.id);
  if (existing) {
    const preserved = {
      status: existing.status,
      branch: existing.branch,
      worktree: existing.worktree,
      base_revision: existing.base_revision,
      attempt: existing.attempt,
    };
    Object.assign(existing, normalizeTask(repair), preserved);
    existing.gate_binding = {
      owner_type: "milestone",
      owner_id: item.id,
      requirement_id: item.failed_gate_id,
    };
  } else {
    const task = normalizeTask(repair);
    task.gate_binding = {
      owner_type: "milestone",
      owner_id: item.id,
      requirement_id: item.failed_gate_id,
    };
    item.tasks.push(task);
  }
  item.status = "active";
  manifest.status = "active";
  manifest.decisions.push({
    at: now(),
    summary: `Diagnosed ${item.id}/${item.failed_gate_id}`,
    rationale: diagnosis,
    milestone_id: item.id,
    task_id: repair.id,
  });
  writeManifest(base, manifest);
  return summarizeProject(base, manifest);
}

export function recordProjectDecision(
  base: string,
  id: string,
  summary: string,
  rationale: string,
  milestoneId?: string,
  taskId?: string,
): ProjectStatusReport {
  const manifest = readProjectManifest(base, id);
  if (!summary.trim() || !rationale.trim()) {
    throw new Error("Project decisions require a summary and rationale");
  }
  if (milestoneId) milestone(manifest, milestoneId);
  if (taskId) locateTask(manifest, taskId);
  manifest.decisions.push({
    at: now(),
    summary,
    rationale,
    ...(milestoneId ? { milestone_id: milestoneId } : {}),
    ...(taskId ? { task_id: taskId } : {}),
  });
  writeManifest(base, manifest);
  return summarizeProject(base, manifest);
}
