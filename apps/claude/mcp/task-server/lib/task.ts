import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type TaskPhase = "design" | "implement" | "audit";
export type AuditVerdict = "pass" | "fail";
export type TaskRisk = "low" | "medium" | "high";
export type ChangeRadius = "local" | "component" | "service" | "system" | "operational";
export type EvidenceResult = "pass" | "fail" | "not_run";
export interface RequiredEvidence { id: string; kind: string; command: string; proves: string }
export interface TaskContract {
  status: "draft" | "ready"; risk: TaskRisk; change_radius: ChangeRadius[];
  allowed_paths: string[]; forbidden_paths: string[]; acceptance_criteria: string[];
  required_evidence: RequiredEvidence[];
}
export interface EvidenceRecord {
  requirement_id: string; command: string; result: EvidenceResult; artifact?: string; note: string; recorded_at: string;
}

export interface PhaseMetrics { phase: TaskPhase; visits: number; active_ms: number }
export interface TaskMetrics {
  total_ms: number;
  phases: PhaseMetrics[];
  repair_iterations: number;
  evidence_runs: number;
  evidence_pass: number;
  evidence_fail: number;
  computed_at: string;
}

export interface TaskManifest {
  schema_version?: 1 | 2;
  id: string;
  title: string;
  status: "active" | "done";
  current_phase: TaskPhase;
  created_at: string;
  updated_at: string;
  branch?: string;
  branch_checked_out?: boolean;
  docs: { design: string; audit: string; decisions: string };
  phase_log: Array<{ phase: TaskPhase; at: string; note: string }>;
  contract?: TaskContract;
  evidence?: EvidenceRecord[];
  metrics?: TaskMetrics;
}

const tasksDir = "docs/tasks";
const idPattern = /^(\d{4})-([a-z0-9-]+)$/;
const transitions: Record<TaskPhase, TaskPhase[]> = {
  design: ["design", "implement"],
  implement: ["design", "implement", "audit"],
  audit: ["implement", "audit"],
};
const decisionSections = [
  "State Transition",
  "Decisions",
  "Removed",
  "Blast Radius",
  "Verification Evidence",
  "Remaining Work",
];

function readyContract(manifest: TaskManifest): TaskContract {
  if (manifest.schema_version !== 2 || !manifest.contract) throw new Error("Active legacy task must be upgraded with task_contract before implementation.");
  const contract = manifest.contract;
  if (contract.status !== "ready") throw new Error("Task contract must be ready before implementation.");
  if (!contract.change_radius.length || !contract.allowed_paths.length || !contract.acceptance_criteria.length || !contract.required_evidence.length) {
    throw new Error("Ready task contract requires radius, allowed paths, acceptance criteria, and evidence.");
  }
  const ids = new Set<string>();
  for (const item of contract.required_evidence) {
    if (!item.id.trim() || !item.kind.trim() || !item.command.trim() || !item.proves.trim()) throw new Error("Evidence requirements must be complete.");
    if (ids.has(item.id)) throw new Error(`Duplicate evidence id: ${item.id}`);
    ids.add(item.id);
  }
  return contract;
}

function requireEvidence(manifest: TaskManifest): void {
  const contract = readyContract(manifest);
  const records = manifest.evidence ?? [];
  const missing = contract.required_evidence.filter((requirement) => {
    const latest = records.filter((record) => record.requirement_id === requirement.id).at(-1);
    return latest?.result !== "pass" || latest.command !== requirement.command;
  });
  if (missing.length) throw new Error(`Required evidence has not passed: ${missing.map((item) => item.id).join(", ")}`);
}

function globMatches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("?", "[^/]").replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function git(base: string, args: string[]): string {
  return execFileSync("git", args, { cwd: base, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function defaultBranch(base: string): string {
  try { return git(base, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, ""); }
  catch {
    for (const candidate of ["main", "master"]) {
      try { git(base, ["rev-parse", "--verify", candidate]); return candidate; } catch { continue; }
    }
  }
  throw new Error("Could not determine default branch.");
}

function requireTaskBranch(base: string, manifest: TaskManifest): void {
  if (!manifest.branch) throw new Error(`Task ${manifest.id} has no branch recorded.`);
  const current = git(base, ["branch", "--show-current"]);
  if (current !== manifest.branch) {
    throw new Error(`Task ${manifest.id} requires branch ${manifest.branch}; current branch is ${current || "(detached HEAD)"}.`);
  }
  if (manifest.branch_checked_out === false) {
    throw new Error(`Task ${manifest.id} branch is not marked as checked out.`);
  }
}

function requireScope(base: string, manifest: TaskManifest): void {
  const contract = readyContract(manifest);
  const committed = git(base, ["diff", "--name-only", `${defaultBranch(base)}...HEAD`]).split("\n");
  const staged = git(base, ["diff", "--cached", "--name-only"]).split("\n");
  const unstaged = git(base, ["diff", "--name-only"]).split("\n");
  const untracked = git(base, ["ls-files", "--others", "--exclude-standard"]).split("\n");
  const changed = [...new Set([...committed, ...staged, ...unstaged, ...untracked].map((path) => path.trim()).filter(Boolean))];
  const violations = changed.filter((path) => contract.forbidden_paths.some((pattern) => globMatches(path, pattern)) || !contract.allowed_paths.some((pattern) => globMatches(path, pattern)));
  if (violations.length) throw new Error(`Changed paths violate task contract: ${violations.join(", ")}`);
}

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const root = (base: string) => join(base, tasksDir);
const pathFor = (base: string, id: string) => join(root(base), id);
const manifestPath = (base: string, id: string) => join(pathFor(base, id), "task.json");

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function title(value: string): string {
  return value.trim().split(/\s+/).map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function ensureRoot(base: string): void {
  mkdirSync(root(base), { recursive: true });
}

function readManifest(base: string, id: string): TaskManifest {
  const file = manifestPath(base, id);
  if (!existsSync(file)) throw new Error(`Task not found: ${id}`);
  return JSON.parse(readFileSync(file, "utf8")) as TaskManifest;
}

const metricPhases: TaskPhase[] = ["design", "implement", "audit"];

/**
 * Derive timing and throughput metrics from the append-only phase_log. Each phase is owned by one
 * agent, so time attributed to a phase is that agent's wall-clock working window. Consecutive
 * same-phase entries collapse into one visit; a return to a phase counts as a fresh visit, so
 * implement re-entries after a failed audit surface as repair iterations.
 */
export function computeTaskMetrics(manifest: TaskManifest, nowMs: number = Date.now()): TaskMetrics {
  const log = manifest.phase_log ?? [];
  const active: Record<TaskPhase, number> = { design: 0, implement: 0, audit: 0 };
  const visits: Record<TaskPhase, number> = { design: 0, implement: 0, audit: 0 };
  const endMs = manifest.status === "done" && log.length ? Date.parse(log[log.length - 1]!.at) : nowMs;

  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;
    const startMs = Date.parse(entry.at);
    const nextMs = i + 1 < log.length ? Date.parse(log[i + 1]!.at) : endMs;
    if (Number.isFinite(startMs) && Number.isFinite(nextMs)) active[entry.phase] += Math.max(0, nextMs - startMs);
    if (i === 0 || log[i - 1]!.phase !== entry.phase) visits[entry.phase] += 1;
  }

  const startMs = log.length ? Date.parse(log[0]!.at) : nowMs;
  const total_ms = Number.isFinite(startMs) ? Math.max(0, endMs - startMs) : 0;
  const evidence = manifest.evidence ?? [];
  return {
    total_ms,
    phases: metricPhases.map((phase) => ({ phase, visits: visits[phase], active_ms: active[phase] })),
    repair_iterations: Math.max(0, visits.implement - 1),
    evidence_runs: evidence.length,
    evidence_pass: evidence.filter((record) => record.result === "pass").length,
    evidence_fail: evidence.filter((record) => record.result === "fail").length,
    computed_at: new Date(nowMs).toISOString(),
  };
}

function writeManifest(base: string, manifest: TaskManifest): void {
  mkdirSync(pathFor(base, manifest.id), { recursive: true });
  manifest.metrics = computeTaskMetrics(manifest);
  writeFileSync(manifestPath(base, manifest.id), `${JSON.stringify(manifest, null, 2)}\n`);
}

function taskIds(base: string): string[] {
  if (!existsSync(root(base))) return [];
  return readdirSync(root(base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && idPattern.test(entry.name))
    .map((entry) => entry.name);
}

function requireSections(file: string, sections: string[]): void {
  if (!existsSync(file)) throw new Error(`Required document is missing: ${file}`);
  const content = readFileSync(file, "utf8");
  const missing = sections.filter((section) => !new RegExp(`^##\\s+${section}\\s*$`, "m").test(content));
  if (missing.length) throw new Error(`Required document is missing sections: ${missing.join(", ")}`);
}

export function resolveTask(base: string, idOrPrefix: string): string {
  const input = idOrPrefix.trim();
  if (!input) throw new Error("Task ID is required.");
  if (existsSync(manifestPath(base, input))) return input;
  if (/^\d{1,4}$/.test(input)) {
    const match = taskIds(base).filter((id) => id.startsWith(`${input.padStart(4, "0")}-`));
    if (match.length === 1) return match[0]!;
  }
  throw new Error(`Task not found: ${input}`);
}

export function createTask(base: string, description: string): TaskManifest {
  ensureRoot(base);
  const normalizedSlug = slug(description);
  if (!normalizedSlug) throw new Error("Description must contain an alphanumeric character.");
  const highest = taskIds(base).reduce((value, id) => Math.max(value, Number(id.slice(0, 4))), 0);
  const id = `${String(highest + 1).padStart(4, "0")}-${normalizedSlug}`;
  const manifest: TaskManifest = {
    schema_version: 2,
    id,
    title: title(description),
    status: "active",
    current_phase: "design",
    created_at: today(),
    updated_at: today(),
    docs: { design: "design.md", audit: "audit.md", decisions: "decisions.md" },
    phase_log: [{ phase: "design", at: now(), note: "initial scope" }],
    contract: { status: "draft", risk: "low", change_radius: ["local"], allowed_paths: [], forbidden_paths: [], acceptance_criteria: [], required_evidence: [] },
    evidence: [],
  };
  writeManifest(base, manifest);
  return manifest;
}

export function setContract(base: string, id: string, contract: TaskContract): TaskManifest {
  const manifest = readManifest(base, id);
  if (manifest.status === "done") throw new Error(`Task is closed: ${id}`);
  manifest.schema_version = 2; manifest.contract = contract; manifest.evidence ??= [];
  if (contract.status === "ready") readyContract(manifest);
  manifest.updated_at = today();
  manifest.phase_log.push({ phase: manifest.current_phase, at: now(), note: `task contract ${contract.status}` });
  writeManifest(base, manifest); return manifest;
}

export function recordEvidence(base: string, id: string, record: Omit<EvidenceRecord, "recorded_at">): TaskManifest {
  const manifest = readManifest(base, id); const contract = readyContract(manifest);
  const requirement = contract.required_evidence.find((item) => item.id === record.requirement_id);
  if (!requirement) throw new Error(`Unknown evidence requirement: ${record.requirement_id}`);
  if (requirement.command !== record.command) throw new Error(`Evidence command does not match contract for ${record.requirement_id}.`);
  manifest.evidence = [...(manifest.evidence ?? []), { ...record, recorded_at: now() }];
  manifest.updated_at = today(); writeManifest(base, manifest); return manifest;
}

export function setTaskBranch(
  base: string,
  id: string,
  branch: string,
  checkedOut: boolean,
  note: string,
): TaskManifest {
  const manifest = readManifest(base, id);
  manifest.branch = branch;
  manifest.branch_checked_out = checkedOut;
  manifest.updated_at = today();
  manifest.phase_log.push({ phase: manifest.current_phase, at: now(), note });
  writeManifest(base, manifest);
  return manifest;
}

export function status(base: string, id: string): Record<string, unknown> {
  const manifest = readManifest(base, id);
  manifest.metrics = computeTaskMetrics(manifest);
  const folder = pathFor(base, id);
  const docs = Object.fromEntries(
    Object.entries(manifest.docs).map(([key, filename]) => [key, existsSync(join(folder, filename))]),
  );
  const suggestedAgent = manifest.status === "done"
    ? null
    : ({ design: "/design", implement: "implement", audit: "audit" } as const)[manifest.current_phase];
  return { manifest, path: join(tasksDir, id), docs, suggestedAgent };
}

export function list(base: string): Record<string, unknown>[] {
  ensureRoot(base);
  return taskIds(base).sort().map((id) => status(base, id));
}

export function advance(base: string, id: string, phase: TaskPhase, note: string): TaskManifest {
  const manifest = readManifest(base, id);
  if (manifest.status === "done") throw new Error(`Task is closed: ${id}`);
  if (!transitions[manifest.current_phase].includes(phase)) {
    throw new Error(`Cannot advance from ${manifest.current_phase} to ${phase}.`);
  }
  const folder = pathFor(base, id);
  if (manifest.current_phase === "design" && phase === "implement") {
    requireSections(join(folder, manifest.docs.design), ["State Transition", "Removal Inventory"]);
    readyContract(manifest);
  }
  if (manifest.current_phase === "implement" && phase === "audit" && !existsSync(join(folder, manifest.docs.design))) {
    throw new Error(`Cannot advance to audit without ${manifest.docs.design}.`);
  }
  if (manifest.current_phase === "implement" && phase === "audit") { requireEvidence(manifest); requireScope(base, manifest); }
  if (phase === "implement" || phase === "audit") requireTaskBranch(base, manifest);
  manifest.current_phase = phase;
  manifest.updated_at = today();
  manifest.phase_log.push({ phase, at: now(), note });
  writeManifest(base, manifest);
  return manifest;
}

export function close(
  base: string,
  id: string,
  verdict: AuditVerdict,
  note: string,
  foundationalBlockers: number,
): TaskManifest {
  const manifest = readManifest(base, id);
  if (manifest.status === "done") throw new Error(`Task is already closed: ${id}`);
  if (manifest.current_phase !== "audit") throw new Error(`Task must be in audit; current phase: ${manifest.current_phase}.`);
  if (!Number.isInteger(foundationalBlockers) || foundationalBlockers < 0) throw new Error("foundationalBlockers must be a non-negative integer.");
  if (verdict === "fail") return advance(base, id, "implement", `audit failed: ${note}`);
  if (foundationalBlockers) throw new Error("Cannot close a task with foundational blockers.");
  requireTaskBranch(base, manifest);
  requireEvidence(manifest);
  requireScope(base, manifest);
  const folder = pathFor(base, id);
  requireSections(join(folder, manifest.docs.decisions), decisionSections);
  for (const document of [manifest.docs.design, manifest.docs.audit]) {
    const file = join(folder, document);
    if (existsSync(file)) unlinkSync(file);
  }
  manifest.status = "done";
  manifest.updated_at = today();
  manifest.phase_log.push({ phase: "audit", at: now(), note: `audit passed: ${note}` });
  writeManifest(base, manifest);
  return manifest;
}
