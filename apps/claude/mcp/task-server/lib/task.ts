import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type TaskPhase = "design" | "implement" | "audit";
export type AuditVerdict = "pass" | "fail";

export interface TaskManifest {
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

function writeManifest(base: string, manifest: TaskManifest): void {
  mkdirSync(pathFor(base, manifest.id), { recursive: true });
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
    id,
    title: title(description),
    status: "active",
    current_phase: "design",
    created_at: today(),
    updated_at: today(),
    docs: { design: "design.md", audit: "audit.md", decisions: "decisions.md" },
    phase_log: [{ phase: "design", at: now(), note: "initial scope" }],
  };
  writeManifest(base, manifest);
  return manifest;
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
  }
  if (manifest.current_phase === "implement" && phase === "audit" && !existsSync(join(folder, manifest.docs.design))) {
    throw new Error(`Cannot advance to audit without ${manifest.docs.design}.`);
  }
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
