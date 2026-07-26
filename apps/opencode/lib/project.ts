import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ProjectStatus = "design" | "active" | "reconciling" | "blocked" | "done";
export type ProjectNodeStatus = "ready" | "running" | "verified" | "merged" | "reconciling" | "blocked";
export type EvidenceLevel = "baseline" | "package" | "final";

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
  node_id?: string;
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

export interface ProjectNode {
  id: string;
  title: string;
  status: ProjectNodeStatus;
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

export interface ProjectDecision {
  at: string;
  node_id?: string;
  kind: "decision" | "reconciliation";
  summary: string;
  rationale: string;
  base_revision?: string;
  integrated_revision?: string;
}

export interface ProjectManifest {
  schema_version: 2;
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  integration_branch: string;
  integration_base: string;
  nodes: ProjectNode[];
  evidence: EvidenceRecord[];
  decisions: ProjectDecision[];
}

export interface ProjectStatusReport {
  manifest: ProjectManifest;
  path: string;
  ready_nodes: ProjectNode[];
  metrics_path: string;
  git?: { current_branch: string; on_integration_branch: boolean };
}

const PROJECTS_DIR = ".projects";
const MANIFEST = "project.json";
const METRICS = "metrics.jsonl";
const ID = /^(\d{4})-([a-z0-9-]+)$/;
const now = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function run(base: string, args: string[]): string {
  return execFileSync("git", args, { cwd: base, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function revision(base: string, ref = "HEAD"): string { return run(base, ["rev-parse", ref]); }
function branchExists(base: string, branch: string): boolean {
  try { revision(base, branch); return true; } catch { return false; }
}
function defaultBranch(base: string): string {
  try { return run(base, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, ""); }
  catch {
    for (const candidate of ["main", "master"]) if (branchExists(base, candidate)) return candidate;
  }
  throw new Error("Could not determine the default branch.");
}
function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}
function title(value: string): string {
  return value.trim().split(/\s+/).map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
function root(base: string): string { return join(base, PROJECTS_DIR); }
function folder(base: string, id: string): string { return join(root(base), id); }
function manifestPath(base: string, id: string): string { return join(folder(base, id), MANIFEST); }
export function metricsPath(base: string, id: string): string { return join(folder(base, id), METRICS); }
function ensureRoot(base: string): void {
  mkdirSync(root(base), { recursive: true });
  const ignore = join(root(base), ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "**\n!.gitignore\n");
}
function read(base: string, id: string): ProjectManifest {
  const file = manifestPath(base, id);
  if (!existsSync(file)) throw new Error(`Project not found: ${id}`);
  return JSON.parse(readFileSync(file, "utf8")) as ProjectManifest;
}
function write(base: string, manifest: ProjectManifest): void {
  mkdirSync(folder(base, manifest.id), { recursive: true });
  writeFileSync(manifestPath(base, manifest.id), `${JSON.stringify(manifest, null, 2)}\n`);
}
function matches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("?", "[^/]").replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}
function changed(base: string, from: string, to = "HEAD"): string[] {
  return run(base, ["diff", "--name-only", `${from}...${to}`]).split("\n").map((item) => item.trim()).filter(Boolean);
}
function node(manifest: ProjectManifest, nodeId: string): ProjectNode {
  const value = manifest.nodes.find((item) => item.id === nodeId);
  if (!value) throw new Error(`Project node not found: ${nodeId}`);
  return value;
}
function latestEvidence(manifest: ProjectManifest, requirementId: string, nodeId?: string): EvidenceRecord | undefined {
  return manifest.evidence.filter((record) => record.requirement_id === requirementId && record.node_id === nodeId).at(-1);
}
function isFresh(record: EvidenceRecord | undefined, requirement: EvidenceRequirement, expectedRevision?: string): boolean {
  return record?.result === "pass" && !record.invalidated_at && record.level === requirement.level &&
    JSON.stringify(record.command) === JSON.stringify(requirement.command) && JSON.stringify(record.covers) === JSON.stringify(requirement.covers) &&
    (!expectedRevision || record.end_revision === expectedRevision);
}
function dependenciesMet(manifest: ProjectManifest, item: ProjectNode): boolean {
  return item.depends_on.every((dependency) => node(manifest, dependency).status === "merged");
}
function assertAcyclic(nodes: ProjectNode[]): void {
  const visiting = new Set<string>(); const visited = new Set<string>(); const byId = new Map(nodes.map((item) => [item.id, item]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Project dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id); for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const item of nodes) visit(item.id);
}
function staticPrefix(pattern: string): string { return pattern.slice(0, pattern.search(/[?*]/) < 0 ? pattern.length : pattern.search(/[?*]/)); }
function overlappingWrites(left: ProjectNode, right: ProjectNode): boolean {
  return left.allowed_paths.some((a) => right.allowed_paths.some((b) => {
    const aPrefix = staticPrefix(a); const bPrefix = staticPrefix(b);
    return a === b || aPrefix.startsWith(bPrefix) || bPrefix.startsWith(aPrefix) || matches(a.replace(/[?*].*$/, "x"), b) || matches(b.replace(/[?*].*$/, "x"), a);
  }));
}
function reservesWrites(item: ProjectNode): boolean { return ["running", "verified", "reconciling"].includes(item.status); }
function scopeViolations(base: string, item: ProjectNode, from: string, to = "HEAD"): string[] {
  return changed(base, from, to).filter((path) => item.forbidden_paths.some((pattern) => matches(path, pattern)) || !item.allowed_paths.some((pattern) => matches(path, pattern)));
}
function validateNodes(nodes: ProjectNode[]): void {
  const ids = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const item of nodes) {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id)) throw new Error(`Project node IDs must be unique kebab-case: ${item.id}`);
    ids.add(item.id);
    if (!item.title.trim()) throw new Error(`Project node ${item.id} needs a title.`);
    for (const requirement of item.required_evidence) {
      if (!requirement.id.trim() || !requirement.command.length || requirement.command.some((part) => !part.trim()) || !requirement.proves.trim() || !requirement.covers.length || evidenceIds.has(requirement.id)) {
        throw new Error(`Project evidence must be complete and uniquely identified: ${requirement.id}`);
      }
      if (requirement.timeout_ms !== undefined && (!Number.isFinite(requirement.timeout_ms) || requirement.timeout_ms <= 0 || requirement.timeout_ms > 900_000)) throw new Error(`Project evidence timeout must be between 1 and 900000ms: ${requirement.id}`);
      evidenceIds.add(requirement.id);
    }
  }
  for (const item of nodes) if (item.depends_on.some((dependency) => !ids.has(dependency) || dependency === item.id)) throw new Error(`Project node ${item.id} has an invalid dependency.`);
  assertAcyclic(nodes);
}
function invalidate(manifest: ProjectManifest, paths: string[], reason: string): void {
  for (const record of manifest.evidence) {
    const requirement = manifest.nodes.flatMap((item) => item.required_evidence).find((item) => item.id === record.requirement_id);
    if (!record.invalidated_at && record.result === "pass" && requirement?.covers.some((pattern) => paths.some((path) => matches(path, pattern)))) {
      record.invalidated_at = now(); record.invalidated_by = reason;
    }
  }
}
function worktreeRoot(base: string, manifest: ProjectManifest, item: ProjectNode): string {
  return join(dirname(base), ".opencode-worktrees", hash(base).slice(0, 16), manifest.id, item.id, String(item.attempt ?? 1));
}
function assertIntegrationBranch(base: string, manifest: ProjectManifest): void {
  const current = run(base, ["branch", "--show-current"]);
  if (current !== manifest.integration_branch) throw new Error(`Operation requires ${manifest.integration_branch}; current branch is ${current || "(detached)"}.`);
}
function runRequirement(base: string, manifest: ProjectManifest, requirement: EvidenceRequirement, item?: ProjectNode): void {
  const cwd = item?.worktree ?? base;
  const baseRevision = item?.base_revision ?? manifest.integration_base;
  const executable = requirement.command[0]!; const args = requirement.command.slice(1); const executableName = executable.split("/").at(-1)?.toLowerCase();
  const unsafeGit = executableName === "git" && (["reset", "clean", "restore"].includes(args[0] ?? "") || (args[0] === "checkout" && args[1] === "--") || (args[0] === "push" && args.some((arg) => arg === "-f" || arg.startsWith("--force"))));
  if (["rm", "sudo", "sh", "bash", "zsh", "fish"].includes(executableName ?? "") || unsafeGit) {
    throw new Error(`Unsafe evidence command is not allowed: ${requirement.id}`);
  }
  const packageWorktree = Boolean(item?.worktree);
  const dirty = run(cwd, ["status", "--porcelain"]).split("\n").filter(Boolean).filter((line) => packageWorktree || (!line.endsWith(" .projects/.gitignore") && !line.endsWith(" .projects/")));
  if (dirty.length) throw new Error(`Evidence requires a clean ${packageWorktree ? "package" : "integration"} worktree: ${requirement.id}`);
  const timeout = requirement.timeout_ms ?? 120_000;
  const started = Date.now(); const startedAt = now();
  const result = spawnSync(executable, args, { cwd, shell: false, encoding: "utf8", timeout });
  const code = typeof result.status === "number" ? result.status : null;
  manifest.evidence.push({
    requirement_id: requirement.id, node_id: item?.id, level: requirement.level, command: requirement.command, covers: requirement.covers,
    result: code === 0 ? "pass" : "fail", started_at: startedAt, finished_at: now(), duration_ms: Date.now() - started,
    exit_code: code, base_revision: baseRevision, end_revision: revision(cwd), changed_paths: changed(cwd, baseRevision),
    note: code === 0 ? requirement.proves : (result.stderr || result.stdout || "command failed").trim().slice(0, 1000),
  });
}

export function resolveProject(base: string, idOrName: string): string {
  const input = idOrName.trim();
  if (!input) throw new Error("Project ID or name is required.");
  if (existsSync(manifestPath(base, input))) return input;
  ensureRoot(base);
  const entries = readdirSync(root(base)).filter((entry) => ID.test(entry) && existsSync(manifestPath(base, entry)));
  const numeric = /^\d{1,4}$/.test(input) ? input.padStart(4, "0") : undefined;
  const name = slug(input);
  const found = entries.filter((entry) => numeric ? entry.startsWith(`${numeric}-`) : entry === name || entry.endsWith(`-${name}`));
  if (found.length === 1) return found[0]!;
  if (found.length > 1) throw new Error(`Ambiguous project ${input}: ${found.join(", ")}`);
  throw new Error(`Project not found: ${input}`);
}

export function createProject(base: string, description: string): ProjectManifest {
  ensureRoot(base); run(base, ["rev-parse", "--is-inside-work-tree"]);
  const name = slug(description); if (!name) throw new Error("Project name must contain an alphanumeric character.");
  const highest = readdirSync(root(base), { withFileTypes: true }).filter((entry) => entry.isDirectory() && ID.test(entry.name)).reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 4))), 0);
  const id = `${String(highest + 1).padStart(4, "0")}-${name}`;
  const integrationBranch = `project/${id}`;
  if (branchExists(base, integrationBranch)) throw new Error(`Project branch already exists: ${integrationBranch}`);
  const source = defaultBranch(base); run(base, ["branch", integrationBranch, source]); run(base, ["switch", integrationBranch]);
  const manifest: ProjectManifest = {
    schema_version: 2, id, title: title(description), status: "design", created_at: now(), updated_at: now(),
    integration_branch: integrationBranch, integration_base: revision(base, source), nodes: [], evidence: [], decisions: [],
  };
  write(base, manifest); return manifest;
}

export function setProjectPlan(base: string, id: string, nodes: ProjectNode[]): ProjectManifest {
  const manifest = read(base, id);
  if (manifest.status !== "design") throw new Error(`Project ${id} is not in design.`);
  const normalized = nodes.map((item) => ({ ...item, status: "ready" as const, depends_on: item.depends_on ?? [], allowed_paths: item.allowed_paths ?? [], forbidden_paths: item.forbidden_paths ?? [], discovery_paths: item.discovery_paths ?? [], acceptance_criteria: item.acceptance_criteria ?? [], required_evidence: item.required_evidence ?? [] }));
  validateNodes(normalized); manifest.nodes = normalized; manifest.status = "active"; manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function readyNodes(base: string, id: string): ProjectNode[] {
  const manifest = read(base, id);
  return manifest.nodes.filter((item) => item.status === "ready" && dependenciesMet(manifest, item) && !manifest.nodes.some((other) => reservesWrites(other) && overlappingWrites(item, other)));
}

export function dispatchProjectNode(base: string, id: string, nodeId: string): ProjectManifest {
  const manifest = read(base, id); if (manifest.status !== "active") throw new Error(`Project ${id} is not active.`);
  const item = node(manifest, nodeId); if (item.status !== "ready") throw new Error(`Project node ${nodeId} is not ready.`);
  if (!dependenciesMet(manifest, item)) throw new Error(`Dependencies are not complete for ${nodeId}.`);
  if (manifest.nodes.some((other) => reservesWrites(other) && overlappingWrites(item, other))) throw new Error(`Project node ${nodeId} overlaps an active package.`);
  item.attempt = (item.attempt ?? 0) + 1; item.branch = `work/${manifest.id}-${item.id}-${item.attempt}`; item.worktree = worktreeRoot(base, manifest, item);
  mkdirSync(dirname(item.worktree), { recursive: true }); run(base, ["worktree", "add", "-b", item.branch, item.worktree, manifest.integration_branch]);
  item.base_revision = revision(item.worktree); item.status = "running"; manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function verifyProjectRequirement(base: string, id: string, requirementId: string, nodeId?: string): ProjectManifest {
  const manifest = read(base, id); const item = nodeId ? node(manifest, nodeId) : undefined;
  const requirement = item?.required_evidence.find((entry) => entry.id === requirementId) ?? manifest.nodes.flatMap((entry) => entry.required_evidence).find((entry) => entry.id === requirementId);
  if (!requirement) throw new Error(`Unknown project evidence requirement: ${requirementId}`);
  if (["baseline", "package"].includes(requirement.level) && (!item || item.status !== "running")) throw new Error(`${requirement.level} evidence requires a running node.`);
  if (requirement.level === "baseline" && revision(item!.worktree!) !== item!.base_revision) throw new Error("Baseline evidence must run before package changes.");
  runRequirement(base, manifest, requirement, item); manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function markProjectNodeVerified(base: string, id: string, nodeId: string): ProjectManifest {
  const manifest = read(base, id); const item = node(manifest, nodeId);
  if (item.status !== "running" || !item.worktree || !item.base_revision) throw new Error(`Project node ${nodeId} is not a running package.`);
  const violations = scopeViolations(item.worktree, item, item.base_revision); if (violations.length) throw new Error(`Project node ${nodeId} changed paths outside its contract: ${violations.join(", ")}`);
  const end = revision(item.worktree);
  const missing = item.required_evidence.filter((requirement) => requirement.level === "package" && !isFresh(latestEvidence(manifest, requirement.id, item.id), requirement, end));
  if (missing.length) throw new Error(`Fresh package evidence is required: ${missing.map((entry) => entry.id).join(", ")}`);
  const missingBaseline = item.required_evidence.filter((requirement) => requirement.level === "baseline" && !isFresh(latestEvidence(manifest, requirement.id, item.id), requirement, item.base_revision));
  if (missingBaseline.length) throw new Error(`Baseline evidence is required: ${missingBaseline.map((entry) => entry.id).join(", ")}`);
  item.status = "verified"; item.verified_revision = end; manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function mergeProjectNode(base: string, id: string, nodeId: string): ProjectManifest {
  const manifest = read(base, id); const item = node(manifest, nodeId); assertIntegrationBranch(base, manifest);
  if (item.status !== "verified" || !item.branch || !item.worktree || !item.base_revision || !item.verified_revision) throw new Error(`Project node ${nodeId} is not verified for merge.`);
  if (!dependenciesMet(manifest, item)) throw new Error(`Dependencies are no longer complete for ${nodeId}.`);
  if (run(item.worktree, ["status", "--porcelain"])) throw new Error(`Project node ${nodeId} has uncommitted changes after verification.`);
  if (revision(item.worktree) !== item.verified_revision) throw new Error(`Project node ${nodeId} changed after verification.`);
  const stale = item.required_evidence.filter((requirement) => requirement.level === "package" && !isFresh(latestEvidence(manifest, requirement.id, item.id), requirement, item.verified_revision));
  if (stale.length) throw new Error(`Package evidence became stale: ${stale.map((entry) => entry.id).join(", ")}`);
  const violations = scopeViolations(item.worktree, item, item.base_revision); if (violations.length) throw new Error(`Project node ${nodeId} changed paths outside its contract: ${violations.join(", ")}`);
  const dirty = run(base, ["status", "--porcelain"]).split("\n").filter(Boolean).filter((line) => !line.endsWith(" .projects/.gitignore") && !line.endsWith(" .projects/"));
  if (dirty.length) throw new Error("The integration worktree must be clean before merge.");
  const paths = changed(item.worktree, item.base_revision);
  try { run(base, ["merge", "--no-ff", "--no-commit", item.branch]); run(base, ["commit", "--no-edit"]); }
  catch { try { run(base, ["merge", "--abort"]); } catch { /* preserve the original merge failure */ } throw new Error(`Merge failed for ${nodeId}; integration state was not advanced.`); }
  invalidate(manifest, paths, `merged ${nodeId}`); item.status = "merged"; item.merged_at = now(); manifest.updated_at = now(); write(base, manifest);
  try { run(base, ["worktree", "remove", item.worktree]); item.worktree = undefined; write(base, manifest); } catch { /* merged state remains authoritative; reconciliation can clean the worktree */ }
  return manifest;
}

export function beginReconciliation(base: string, id: string, nodeId: string, rationale: string): ProjectManifest {
  const manifest = read(base, id); const item = node(manifest, nodeId);
  if (item.status === "merged") throw new Error(`Merged node ${nodeId} cannot enter reconciliation.`);
  item.status = "reconciling"; manifest.status = "reconciling";
  manifest.decisions.push({ at: now(), node_id: nodeId, kind: "reconciliation", summary: "Reconciliation started", rationale });
  manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function recordProjectDecision(base: string, id: string, summary: string, rationale: string, nodeId?: string): ProjectManifest {
  const manifest = read(base, id); if (nodeId) node(manifest, nodeId);
  manifest.decisions.push({ at: now(), ...(nodeId ? { node_id: nodeId } : {}), kind: "decision", summary, rationale });
  manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function requeueProjectNode(base: string, id: string, nodeId: string, rationale: string): ProjectManifest {
  const manifest = read(base, id); const item = node(manifest, nodeId);
  if (item.status === "merged") throw new Error(`Merged node ${nodeId} cannot be requeued.`);
  if (item.worktree && existsSync(item.worktree)) {
    if (run(item.worktree, ["status", "--porcelain"])) throw new Error(`Project node ${nodeId} has uncommitted package changes.`);
    run(base, ["worktree", "remove", item.worktree]);
  }
  for (const record of manifest.evidence.filter((entry) => entry.node_id === nodeId && !entry.invalidated_at)) { record.invalidated_at = now(); record.invalidated_by = `requeued ${nodeId}`; }
  item.status = "ready"; item.branch = undefined; item.worktree = undefined; item.base_revision = undefined; item.verified_revision = undefined;
  manifest.status = "active"; manifest.decisions.push({ at: now(), node_id: nodeId, kind: "reconciliation", summary: "Node requeued", rationale });
  manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function adoptIntegratedNode(base: string, id: string, nodeId: string, baseRevision: string, integratedRevision: string, rationale: string): ProjectManifest {
  const manifest = read(base, id); const item = node(manifest, nodeId); assertIntegrationBranch(base, manifest);
  if (item.status === "merged") throw new Error(`Project node ${nodeId} is already merged.`);
  if (revision(base) !== revision(base, integratedRevision)) throw new Error("The integration branch must be checked out at the integrated revision.");
  try { run(base, ["merge-base", "--is-ancestor", baseRevision, integratedRevision]); }
  catch { throw new Error("The reconciliation base is not an ancestor of the integrated revision."); }
  const violations = scopeViolations(base, item, baseRevision, integratedRevision); if (violations.length) throw new Error(`Integrated work changed paths outside ${nodeId}: ${violations.join(", ")}`);
  const adoptedPaths = changed(base, baseRevision, integratedRevision); invalidate(manifest, adoptedPaths, `adopted ${nodeId}`);
  if (item.worktree && existsSync(item.worktree)) {
    if (run(item.worktree, ["status", "--porcelain"])) throw new Error(`Project node ${nodeId} has uncommitted package changes that cannot be discarded during adoption.`);
    run(base, ["worktree", "remove", item.worktree]);
  }
  item.base_revision = revision(base, baseRevision); item.worktree = undefined; item.branch = undefined; item.status = "reconciling";
  const missingBaseline = item.required_evidence.filter((requirement) => requirement.level === "baseline" && !isFresh(latestEvidence(manifest, requirement.id, item.id), requirement, item.base_revision));
  if (missingBaseline.length) throw new Error(`Adoption requires recorded baseline evidence: ${missingBaseline.map((entry) => entry.id).join(", ")}`);
  for (const requirement of item.required_evidence.filter((entry) => entry.level === "package")) runRequirement(base, manifest, requirement, item);
  const end = revision(base, integratedRevision);
  const missing = item.required_evidence.filter((requirement) => requirement.level === "package" && !isFresh(latestEvidence(manifest, requirement.id, item.id), requirement, end));
  if (missing.length) { manifest.status = "blocked"; item.status = "blocked"; write(base, manifest); throw new Error(`Integrated evidence failed: ${missing.map((entry) => entry.id).join(", ")}`); }
  item.status = "merged"; item.merged_at = now(); manifest.status = "active";
  manifest.decisions.push({ at: now(), node_id: nodeId, kind: "reconciliation", summary: "Adopted integrated work", rationale, base_revision: item.base_revision, integrated_revision: end });
  manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function amendProjectNode(base: string, id: string, amendment: ProjectNode, rationale: string): ProjectManifest {
  const manifest = read(base, id); const index = manifest.nodes.findIndex((item) => item.id === amendment.id);
  if (index >= 0 && manifest.nodes[index]!.status === "merged") throw new Error(`Merged node ${amendment.id} is immutable.`);
  const existing = index >= 0 ? manifest.nodes[index] : undefined;
  const normalized: ProjectNode = existing?.worktree ? {
    ...amendment, status: "running", branch: existing.branch, worktree: existing.worktree,
    base_revision: existing.base_revision, verified_revision: undefined, attempt: existing.attempt,
  } : { ...amendment, status: "ready", branch: undefined, worktree: undefined, base_revision: undefined, verified_revision: undefined };
  const next = [...manifest.nodes]; if (index >= 0) next[index] = normalized; else next.push(normalized); validateNodes(next);
  if (existing?.worktree && !dependenciesMet({ ...manifest, nodes: next }, normalized)) throw new Error(`Running node ${amendment.id} cannot gain an unmet dependency.`);
  if (reservesWrites(normalized) && next.some((item) => item.id !== normalized.id && reservesWrites(item) && overlappingWrites(normalized, item))) {
    throw new Error(`Amended node ${amendment.id} overlaps another active package.`);
  }
  manifest.nodes = next; manifest.status = "active";
  for (const record of manifest.evidence.filter((entry) => entry.node_id === amendment.id && !entry.invalidated_at)) { record.invalidated_at = now(); record.invalidated_by = `amended ${amendment.id}`; }
  manifest.decisions.push({ at: now(), node_id: amendment.id, kind: "reconciliation", summary: index >= 0 ? "Amended active node" : "Added unforeseen work", rationale });
  manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function closeProject(base: string, id: string, note: string): ProjectManifest {
  const manifest = read(base, id); assertIntegrationBranch(base, manifest);
  const dirty = run(base, ["status", "--porcelain"]).split("\n").filter(Boolean).filter((line) => !line.endsWith(" .projects/.gitignore") && !line.endsWith(" .projects/"));
  if (dirty.length) throw new Error("The integration worktree must be clean before project close.");
  const incomplete = manifest.nodes.filter((item) => item.status !== "merged"); if (incomplete.length) throw new Error(`Unmerged nodes remain: ${incomplete.map((item) => item.id).join(", ")}`);
  for (const requirement of manifest.nodes.flatMap((item) => item.required_evidence).filter((item) => item.level === "final")) {
    if (!isFresh(latestEvidence(manifest, requirement.id), requirement, revision(base))) throw new Error(`Fresh final evidence at the integration revision is required: ${requirement.id}`);
  }
  manifest.status = "done"; manifest.decisions.push({ at: now(), kind: "decision", summary: "Project closed", rationale: note }); manifest.updated_at = now(); write(base, manifest); return manifest;
}

export function readProjectStatus(base: string, id: string): ProjectStatusReport {
  const manifest = read(base, id); let git: ProjectStatusReport["git"];
  try { const current = run(base, ["branch", "--show-current"]); git = { current_branch: current, on_integration_branch: current === manifest.integration_branch }; } catch { /* status remains useful */ }
  return { manifest, path: `${PROJECTS_DIR}/${id}/${MANIFEST}`, ready_nodes: readyNodes(base, id), metrics_path: `${PROJECTS_DIR}/${id}/${METRICS}`, git };
}

export function listProjects(base: string): ProjectStatusReport[] {
  ensureRoot(base);
  return readdirSync(root(base), { withFileTypes: true }).filter((entry) => entry.isDirectory() && ID.test(entry.name) && existsSync(manifestPath(base, entry.name))).map((entry) => readProjectStatus(base, entry.name)).sort((a, b) => b.manifest.updated_at.localeCompare(a.manifest.updated_at));
}

export function formatProjectReport(report: ProjectStatusReport): string {
  const counts = new Map<ProjectNodeStatus, number>(); for (const item of report.manifest.nodes) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  return [`Project: ${report.manifest.id} - ${report.manifest.title}`, `Status: ${report.manifest.status}`, `Branch: ${report.manifest.integration_branch}`, `Ready: ${report.ready_nodes.map((item) => item.id).join(", ") || "none"}`, `Nodes: ${[...counts].map(([status, count]) => `${status}=${count}`).join(", ") || "none"}`, `Trace: ${report.metrics_path}`].join("\n");
}
