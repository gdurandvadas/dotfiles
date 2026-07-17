import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type TaskPhase = "design" | "implement" | "audit";
export type TaskStatus = "active" | "done";
export type AuditVerdict = "pass" | "fail";

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
  branch?: string;
  branch_checked_out?: boolean;
  docs: {
    design: string;
    audit: string;
    decisions: string;
  };
  phase_log: PhaseLogEntry[];
}

export interface TaskStatusReport {
  manifest: TaskManifest;
  path: string;
  docs: {
    design: boolean;
    audit: boolean;
    decisions: boolean;
  };
  suggestedAgent: string | null;
  git?: {
    currentBranch: string;
    onTaskBranch: boolean | null;
    onDefaultBranch: boolean;
  };
}

const TASKS_DIR = "docs/tasks";
const MANIFEST_FILE = "task.json";
const ID_PATTERN = /^(\d{4})-([a-z0-9-]+)$/;
const ALLOWED_TRANSITIONS: Record<TaskPhase, TaskPhase[]> = {
  design: ["design", "implement"],
  implement: ["design", "implement", "audit"],
  audit: ["implement", "audit"],
};
const DESIGN_REQUIRED_SECTIONS = ["State Transition", "Removal Inventory"];
const DECISIONS_REQUIRED_SECTIONS = [
  "State Transition",
  "Decisions",
  "Removed",
  "Blast Radius",
  "Verification Evidence",
  "Remaining Work",
];

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

export const CHANGE_TYPES = ["feat", "fix", "doc", "chore", "refactor", "perf"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface TaskNewArgs {
  description: string;
  changeType: ChangeType;
  newBranch: boolean;
}

const DEFAULT_BRANCH_CANDIDATES = ["main", "master"] as const;
const TASK_COMMIT_TAG = /\[(\d{4})\]/;

function tokenizeTaskNewArgs(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseBooleanFlag(raw: string, flag: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new Error(`Invalid value for ${flag}: ${raw}`);
}

export function parseTaskNewArgs(raw: string): TaskNewArgs {
  const tokens = tokenizeTaskNewArgs(raw.trim());
  const positional: string[] = [];
  let nameFromFlag = "";
  let changeType: ChangeType | undefined;
  let newBranch = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const eq = token.indexOf("=");
    const key = eq >= 0 ? token.slice(2, eq) : token.slice(2);
    const value = eq >= 0 ? token.slice(eq + 1) : tokens[++i];

    if (value === undefined) {
      throw new Error(`Missing value for --${key}`);
    }

    switch (key) {
      case "name":
        nameFromFlag = value;
        break;
      case "change-type":
        changeType = parseChangeType(value);
        break;
      case "new-branch":
        newBranch = parseBooleanFlag(value, "--new-branch");
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  const description = (nameFromFlag || positional.join(" ")).trim();
  if (!changeType) {
    throw new Error(
      [
        "Missing required --change-type=<feat|fix|doc|chore|refactor|perf>.",
        "Example: /task-new auth migration --change-type=feat",
        "Optional: --new-branch=false to check out an existing branch.",
      ].join("\n"),
    );
  }
  return { description, changeType, newBranch };
}

export function formatTaskBranchName(changeType: ChangeType, taskId: string): string {
  return `${changeType}/${taskId}`;
}

export function parseChangeType(raw: string): ChangeType {
  const normalized = raw.trim().toLowerCase();
  if (!(CHANGE_TYPES as readonly string[]).includes(normalized)) {
    throw new Error(`Invalid change type: ${raw}`);
  }
  return normalized as ChangeType;
}

function git(baseDir: string, args: string[]): string {
  return execFileSync("git", ["-C", baseDir, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitQuiet(baseDir: string, args: string[]): string | null {
  try {
    return git(baseDir, args);
  } catch {
    return null;
  }
}

export function assertGitRepo(baseDir: string): void {
  if (gitQuiet(baseDir, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    throw new Error("Not a git repository.");
  }
}

export function getCurrentBranch(baseDir: string): string {
  assertGitRepo(baseDir);
  return git(baseDir, ["branch", "--show-current"]);
}

export function branchExists(baseDir: string, branch: string): boolean {
  return gitQuiet(baseDir, ["rev-parse", "--verify", branch]) !== null;
}

export function resolveDefaultBranch(baseDir: string): string {
  assertGitRepo(baseDir);
  const originHead = gitQuiet(baseDir, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (originHead) {
    const match = originHead.match(/^refs\/remotes\/origin\/(.+)$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
    if (branchExists(baseDir, candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not determine default branch.");
}

export function isDefaultBranch(baseDir: string, branch?: string): boolean {
  const current = branch ?? getCurrentBranch(baseDir);
  return current !== "" && current === resolveDefaultBranch(baseDir);
}

/** Create or check out the task branch in one atomic operation (never leaves HEAD on default alone). */
export function setupTaskBranch(
  baseDir: string,
  branch: string,
  newBranch: boolean,
): string {
  assertGitRepo(baseDir);

  if (newBranch) {
    if (branchExists(baseDir, branch)) {
      throw new Error(`Branch ${branch} already exists. Use --new-branch=false.`);
    }
    const base = resolveDefaultBranch(baseDir);
    git(baseDir, ["switch", "-c", branch, base]);
    return `Created branch ${branch} from ${base}.`;
  }

  if (!branchExists(baseDir, branch)) {
    throw new Error(`Branch ${branch} does not exist.`);
  }
  git(baseDir, ["switch", branch]);
  return `Checked out ${branch}.`;
}

export function checkoutTaskBranch(baseDir: string, id: string): string {
  const manifest = readManifestFile(baseDir, id);
  if (!manifest.branch) {
    throw new Error(`Task ${id} has no branch recorded.`);
  }
  if (!branchExists(baseDir, manifest.branch)) {
    throw new Error(`Task branch ${manifest.branch} does not exist.`);
  }

  const current = getCurrentBranch(baseDir);
  if (current === manifest.branch) {
    if (!manifest.branch_checked_out) {
      setTaskBranch(baseDir, id, {
        branch: manifest.branch,
        checkedOut: true,
        note: `Confirmed already on ${manifest.branch}.`,
      });
    }
    return `Already on ${manifest.branch}.`;
  }

  git(baseDir, ["switch", manifest.branch]);
  setTaskBranch(baseDir, id, {
    branch: manifest.branch,
    checkedOut: true,
    note: `Checked out ${manifest.branch}.`,
  });
  return `Checked out ${manifest.branch}.`;
}

export function assertOnTaskBranch(baseDir: string, id: string): void {
  const manifest = readManifestFile(baseDir, id);
  if (!manifest.branch) {
    throw new Error(`Task ${id} has no branch recorded.`);
  }
  if (!manifest.branch_checked_out) {
    throw new Error(
      `Task ${id} branch was never checked out. Run /task-continue ${id}.`,
    );
  }

  const current = getCurrentBranch(baseDir);
  if (current !== manifest.branch) {
    throw new Error(
      `On ${current || "(detached HEAD)"}, expected task branch ${manifest.branch}. Run /task-continue ${id}.`,
    );
  }
}

export function extractTaskCommitPrefix(command: string): string | null {
  const match = command.match(TASK_COMMIT_TAG);
  return match?.[1] ?? null;
}

export function isGitCommitCommand(command: string): boolean {
  const normalized = command.trim().replace(/\s+/g, " ");
  return /(?:^|[;&|]\s*)git\s+commit\b/.test(normalized);
}

/**
 * Hard gate for agent-driven commits: never on the default branch; task-tagged
 * commits must land on that task's recorded branch.
 */
export function assertCommitAllowed(baseDir: string, command: string): void {
  if (!isGitCommitCommand(command)) {
    return;
  }

  assertGitRepo(baseDir);
  const current = getCurrentBranch(baseDir);
  if (!current) {
    throw new Error("Refusing git commit on detached HEAD.");
  }
  if (isDefaultBranch(baseDir, current)) {
    throw new Error(
      `Refusing git commit on default branch (${current}). Check out a task branch first.`,
    );
  }

  const prefix = extractTaskCommitPrefix(command);
  if (!prefix) {
    return;
  }

  const matches = listTaskIds(baseDir).filter((id) => id.startsWith(`${prefix}-`));
  if (matches.length === 0) {
    throw new Error(`Refusing task-tagged commit [${prefix}]: no matching task.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Refusing task-tagged commit [${prefix}]: ambiguous tasks ${matches.join(", ")}.`,
    );
  }

  const manifest = readManifestFile(baseDir, matches[0]);
  if (!manifest.branch) {
    throw new Error(`Refusing task-tagged commit [${prefix}]: task has no branch.`);
  }
  if (current !== manifest.branch) {
    throw new Error(
      `Refusing task-tagged commit [${prefix}] on ${current}; expected ${manifest.branch}.`,
    );
  }
}

export function deleteTask(baseDir: string, id: string): void {
  const dir = join(tasksRoot(baseDir), id);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

function taskFilePath(baseDir: string, id: string, filename: string): string {
  return join(tasksRoot(baseDir), id, filename);
}

function assertRequiredSections(filePath: string, sections: string[]): void {
  if (!existsSync(filePath)) {
    throw new Error(`Required document is missing: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const missing = sections.filter(
    (section) => !new RegExp(`^##\\s+${section}\\s*$`, "m").test(content),
  );
  if (missing.length > 0) {
    throw new Error(`Required document is missing sections: ${missing.join(", ")}`);
  }
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
    current_phase: "design",
    created_at: today,
    updated_at: today,
    docs: {
      design: "design.md",
      audit: "audit.md",
      decisions: "decisions.md",
    },
    phase_log: [
      {
        phase: "design",
        at: nowIso(),
        note: "initial scope",
      },
    ],
  };

  writeManifestFile(baseDir, id, manifest);
  const path = join(TASKS_DIR, id);
  return { manifest, path };
}

export function setTaskBranch(
  baseDir: string,
  id: string,
  options: { branch: string; checkedOut: boolean; note: string },
): TaskManifest {
  const manifest = readManifestFile(baseDir, id);
  manifest.branch = options.branch;
  manifest.branch_checked_out = options.checkedOut;
  manifest.updated_at = todayDate();
  manifest.phase_log.push({
    phase: manifest.current_phase,
    at: nowIso(),
    note: options.note,
  });
  writeManifestFile(baseDir, id, manifest);
  return manifest;
}

export function listTasksByBranch(baseDir: string, branch: string): TaskStatusReport[] {
  return listTasks(baseDir).filter((report) => report.manifest.branch === branch);
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
    case "design":
      return "@design";
    case "implement":
      return "@implement";
    case "audit":
      return "@audit";
  }
}

export function readStatus(baseDir: string, id: string): TaskStatusReport {
  const manifest = readManifestFile(baseDir, id);
  const folder = join(tasksRoot(baseDir), id);
  const docs = {
    design: existsSync(join(folder, manifest.docs.design)),
    audit: existsSync(join(folder, manifest.docs.audit)),
    decisions: existsSync(join(folder, manifest.docs.decisions)),
  };

  let git: TaskStatusReport["git"];
  try {
    const currentBranch = getCurrentBranch(baseDir);
    git = {
      currentBranch,
      onTaskBranch: manifest.branch ? currentBranch === manifest.branch : null,
      onDefaultBranch: isDefaultBranch(baseDir, currentBranch),
    };
  } catch {
    git = undefined;
  }

  return {
    manifest,
    path: join(TASKS_DIR, id),
    docs,
    suggestedAgent: suggestedAgentForPhase(manifest.current_phase, manifest.status),
    git,
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
): TaskManifest {
  const manifest = readManifestFile(baseDir, id);
  if (manifest.status === "done") {
    throw new Error(`Task is closed: ${id}`);
  }
  if (!ALLOWED_TRANSITIONS[manifest.current_phase].includes(phase)) {
    throw new Error(`Cannot advance from ${manifest.current_phase} to ${phase}.`);
  }
  if (manifest.current_phase === "design" && phase === "implement") {
    assertRequiredSections(
      taskFilePath(baseDir, id, manifest.docs.design),
      DESIGN_REQUIRED_SECTIONS,
    );
  }
  if (manifest.current_phase === "implement" && phase === "audit") {
    if (!existsSync(taskFilePath(baseDir, id, manifest.docs.design))) {
      throw new Error(`Cannot advance to audit without ${manifest.docs.design}.`);
    }
  }

  if (phase === "implement" || phase === "audit") {
    assertOnTaskBranch(baseDir, id);
  }

  manifest.current_phase = phase;
  manifest.updated_at = todayDate();
  manifest.phase_log.push({
    phase,
    at: nowIso(),
    note,
  });

  writeManifestFile(baseDir, id, manifest);
  return manifest;
}

export function closeTask(
  baseDir: string,
  id: string,
  options: {
    verdict: AuditVerdict;
    note: string;
    foundationalBlockers: number;
  },
): TaskManifest {
  const manifest = readManifestFile(baseDir, id);
  if (manifest.status === "done") {
    throw new Error(`Task is already closed: ${id}`);
  }
  if (manifest.current_phase !== "audit") {
    throw new Error(`Task must be in audit before it can be closed; current phase: ${manifest.current_phase}.`);
  }
  if (!Number.isInteger(options.foundationalBlockers) || options.foundationalBlockers < 0) {
    throw new Error("foundationalBlockers must be a non-negative integer.");
  }

  if (options.verdict === "fail") {
    manifest.current_phase = "implement";
    manifest.updated_at = todayDate();
    manifest.phase_log.push({
      phase: "implement",
      at: nowIso(),
      note: `audit failed: ${options.note}`,
    });
    writeManifestFile(baseDir, id, manifest);
    return manifest;
  }

  assertOnTaskBranch(baseDir, id);

  if (options.foundationalBlockers > 0) {
    throw new Error("Cannot close a task with foundational blockers.");
  }
  assertRequiredSections(
    taskFilePath(baseDir, id, manifest.docs.decisions),
    DECISIONS_REQUIRED_SECTIONS,
  );

  for (const filename of [manifest.docs.design, manifest.docs.audit]) {
    const filePath = taskFilePath(baseDir, id, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  manifest.status = "done";
  manifest.updated_at = todayDate();
  manifest.phase_log.push({
    phase: "audit",
    at: nowIso(),
    note: `audit passed: ${options.note}`,
  });
  writeManifestFile(baseDir, id, manifest);
  return manifest;
}

export function formatCreateResult(
  result: { manifest: TaskManifest; path: string },
  options?: { branchNote?: string },
): string {
  const { manifest, path } = result;
  const lines = [
    `Task created: ${manifest.id}`,
    `Title: ${manifest.title}`,
    `Path: ${path}/`,
    `Phase: ${manifest.current_phase} (${manifest.status})`,
    `Commit prefix: [${taskCommitId(manifest.id)}]`,
    `Commit format: ${taskCommitFormat(manifest.id)}`,
  ];

  if (manifest.branch) {
    lines.push(`Branch: ${manifest.branch}`);
    lines.push(
      `Branch checked out: ${
        manifest.branch_checked_out === undefined
          ? "pending"
          : manifest.branch_checked_out
            ? "yes"
            : "no"
      }`,
    );
    if (options?.branchNote) {
      lines.push(`Branch note: ${options.branchNote}`);
    }
  }

  lines.push("", "Switch to @design when you are ready to design the work.");
  return lines.join("\n");
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
  ];

  if (manifest.branch) {
    lines.push(
      `Branch: ${manifest.branch}`,
      `Branch checked out: ${
        manifest.branch_checked_out === undefined
          ? "pending"
          : manifest.branch_checked_out
            ? "yes"
            : "no"
      }`,
    );
  }

  if (report.git) {
    lines.push(`Current HEAD: ${report.git.currentBranch || "(detached)"}`);
    if (report.git.onDefaultBranch) {
      lines.push("WARNING: on default branch — commits are blocked until you leave it.");
    } else if (report.git.onTaskBranch === false) {
      lines.push(
        `WARNING: not on task branch. Run /task-continue ${manifest.id} before implement/audit.`,
      );
    }
  }

  lines.push(
    "",
    "Docs:",
    `  - design.md: ${docs.design ? "present" : "missing"}`,
    `  - audit.md: ${docs.audit ? "present" : "missing"}`,
    `  - decisions.md: ${docs.decisions ? "present" : "missing"}`,
    "",
    "Recent phase log:",
    ...logLines,
  );

  if (manifest.status === "done") {
    lines.push("", "Task is closed.");
  } else if (suggestedAgent) {
    lines.push("", `Suggested next step: invoke ${suggestedAgent} when ready.`);
  }

  return lines.join("\n");
}
