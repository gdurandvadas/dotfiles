import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type TaskPhase = "research" | "plan" | "implement" | "audit";
export type TaskStatus = "active" | "done";

export interface PhaseLogEntry {
  phase: TaskPhase;
  at: string;
  note: string;
}

export interface TaskManifest {
  id: string;
  title: string;
  status: TaskStatus;
  current_phase: TaskPhase;
  created_at: string;
  updated_at: string;
  docs: {
    research: string;
    plan: string;
    audit: string;
  };
  phase_log: PhaseLogEntry[];
}

export interface TaskStatusReport {
  manifest: TaskManifest;
  path: string;
  docs: {
    research: boolean;
    plan: boolean;
    audit: boolean;
  };
  suggestedAgent: string | null;
}

const TASKS_DIR = "docs/tasks";
const MANIFEST_FILE = "task.json";
const ID_PATTERN = /^(\d{4})-([a-z0-9-]+)$/;

export function taskCommitId(fullId: string): string {
  const match = fullId.match(ID_PATTERN);
  return match ? match[1] : fullId;
}

export function taskCommitFormat(fullId: string): string {
  const id = taskCommitId(fullId);
  return `<type>(<scope>): [${id}] <description>`;
}

export function tasksRoot(baseDir: string): string {
  return join(baseDir, TASKS_DIR);
}

export function toKebabSlug(description: string): string {
  return description
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function toTitle(description: string): string {
  return description
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureTasksDir(baseDir: string): string {
  const root = tasksRoot(baseDir);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

function listTaskIds(baseDir: string): string[] {
  const root = tasksRoot(baseDir);
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
    .map((entry) => entry.name);
}

export function allocateId(baseDir: string, description: string): string {
  ensureTasksDir(baseDir);
  const slug = toKebabSlug(description);
  if (!slug) {
    throw new Error("Description must contain at least one alphanumeric character.");
  }

  const existing = listTaskIds(baseDir);
  let highest = 0;
  for (const id of existing) {
    const match = id.match(ID_PATTERN);
    if (match) {
      highest = Math.max(highest, Number.parseInt(match[1], 10));
    }
  }

  const next = String(highest + 1).padStart(4, "0");
  return `${next}-${slug}`;
}

function manifestPath(baseDir: string, id: string): string {
  return join(tasksRoot(baseDir), id, MANIFEST_FILE);
}

function readManifestFile(baseDir: string, id: string): TaskManifest {
  const filePath = manifestPath(baseDir, id);
  if (!existsSync(filePath)) {
    throw new Error(`Task not found: ${id}`);
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as TaskManifest;
}

function writeManifestFile(baseDir: string, id: string, manifest: TaskManifest): void {
  const dir = join(tasksRoot(baseDir), id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath(baseDir, id), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

export function createTask(
  baseDir: string,
  description: string,
): { manifest: TaskManifest; path: string } {
  const id = allocateId(baseDir, description);
  const today = todayDate();
  const manifest: TaskManifest = {
    id,
    title: toTitle(description),
    status: "active",
    current_phase: "research",
    created_at: today,
    updated_at: today,
    docs: {
      research: "research.md",
      plan: "plan.md",
      audit: "audit.md",
    },
    phase_log: [
      {
        phase: "research",
        at: nowIso(),
        note: "initial scope",
      },
    ],
  };

  writeManifestFile(baseDir, id, manifest);
  const path = join(TASKS_DIR, id);
  return { manifest, path };
}

export function resolveTask(baseDir: string, idOrPrefix: string): string {
  const trimmed = idOrPrefix.trim();
  if (!trimmed) {
    throw new Error("Task ID is required.");
  }

  const root = tasksRoot(baseDir);
  if (!existsSync(root)) {
    throw new Error(`No tasks directory at ${TASKS_DIR}/`);
  }

  const directPath = join(root, trimmed, MANIFEST_FILE);
  if (existsSync(directPath)) {
    return trimmed;
  }

  const numericOnly = /^\d{1,4}$/.test(trimmed);
  if (numericOnly) {
    const padded = trimmed.padStart(4, "0");
    const matches = listTaskIds(baseDir).filter((id) => id.startsWith(`${padded}-`));
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous task prefix ${trimmed}. Matches: ${matches.join(", ")}`);
    }
  }

  throw new Error(`Task not found: ${trimmed}`);
}

function suggestedAgentForPhase(phase: TaskPhase, status: TaskStatus): string | null {
  if (status === "done") {
    return null;
  }
  switch (phase) {
    case "research":
      return "@research";
    case "plan":
      return "@planner";
    case "implement":
      return "@orchestrate";
    case "audit":
      return "@audit";
  }
}

export function readStatus(baseDir: string, id: string): TaskStatusReport {
  const manifest = readManifestFile(baseDir, id);
  const folder = join(tasksRoot(baseDir), id);
  const docs = {
    research: existsSync(join(folder, manifest.docs.research)),
    plan: existsSync(join(folder, manifest.docs.plan)),
    audit: existsSync(join(folder, manifest.docs.audit)),
  };

  return {
    manifest,
    path: join(TASKS_DIR, id),
    docs,
    suggestedAgent: suggestedAgentForPhase(manifest.current_phase, manifest.status),
  };
}

export function listTasks(baseDir: string): TaskStatusReport[] {
  ensureTasksDir(baseDir);
  return listTaskIds(baseDir)
    .sort()
    .map((id) => readStatus(baseDir, id));
}

export function advancePhase(
  baseDir: string,
  id: string,
  phase: TaskPhase,
  note: string,
  options?: { close?: boolean },
): TaskManifest {
  const manifest = readManifestFile(baseDir, id);
  manifest.current_phase = phase;
  manifest.updated_at = todayDate();
  manifest.phase_log.push({
    phase,
    at: nowIso(),
    note,
  });

  if (options?.close || (phase === "audit" && note.toLowerCase().includes("closed"))) {
    manifest.status = "done";
  }

  writeManifestFile(baseDir, id, manifest);
  return manifest;
}

export function formatCreateResult(result: { manifest: TaskManifest; path: string }): string {
  const { manifest, path } = result;
  return [
    `Task created: ${manifest.id}`,
    `Title: ${manifest.title}`,
    `Path: ${path}/`,
    `Phase: ${manifest.current_phase} (${manifest.status})`,
    `Commit prefix: [${taskCommitId(manifest.id)}]`,
    `Commit format: ${taskCommitFormat(manifest.id)}`,
    "",
    "Switch to @research when you are ready to investigate.",
  ].join("\n");
}

export function formatStatusReport(report: TaskStatusReport): string {
  const { manifest, path, docs, suggestedAgent } = report;
  const recentLog = manifest.phase_log.slice(-3);
  const logLines = recentLog.map((entry) => `  - ${entry.phase} (${entry.at}): ${entry.note}`);

  const lines = [
    `Task: ${manifest.id}`,
    `Title: ${manifest.title}`,
    `Path: ${path}/`,
    `Status: ${manifest.status}`,
    `Phase: ${manifest.current_phase}`,
    `Commit format: ${taskCommitFormat(manifest.id)}`,
    "",
    "Docs:",
    `  - research.md: ${docs.research ? "present" : "missing"}`,
    `  - plan.md: ${docs.plan ? "present" : "missing"}`,
    `  - audit.md: ${docs.audit ? "present" : "missing"}`,
    "",
    "Recent phase log:",
    ...logLines,
  ];

  if (manifest.status === "done") {
    lines.push("", "Task is closed.");
  } else if (suggestedAgent) {
    lines.push("", `Suggested next step: invoke ${suggestedAgent} when ready.`);
  }

  return lines.join("\n");
}
