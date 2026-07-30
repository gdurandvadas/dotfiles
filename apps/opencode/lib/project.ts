import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const PROJECTS_DIR = ".projects";
const ALLOWED_COMMIT_TYPES = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
]);

export interface ProjectStartResult {
  id: string;
  title: string;
  baseBranch: string;
  branch: string;
  root: string;
  projectDirectory: string;
  carriedChanges: CarriedChange[];
}

export interface ProjectCommitInput {
  id: string;
  milestone: string;
  paths: string[];
  type: string;
  summary: string;
}

export interface ProjectCommitResult {
  revision: string;
  message: string;
  remainingChanges: string[];
}

export interface ProjectPublishInput {
  id: string;
  title: string;
  body: string;
}

export interface ProjectPublishResult {
  branch: string;
  baseBranch: string;
  url: string;
}

export interface CarriedChange {
  status: string;
  path: string;
}

export class ProjectOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectOperationError";
  }
}

const commandOptions: ExecFileSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  maxBuffer: 16 * 1024 * 1024,
};

function command(cwd: string, executable: string, args: string[]): string {
  try {
    return execFileSync(executable, args, {
      ...commandOptions,
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GH_PROMPT_DISABLED: "1",
      },
    }).trimEnd();
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stderr = String(failure.stderr ?? "").trim();
    const stdout = String(failure.stdout ?? "").trim();
    const diagnostic = stderr || stdout || failure.message || "Unknown command failure";
    throw new ProjectOperationError(
      "COMMAND_FAILED",
      `${executable} ${args.join(" ")} failed: ${diagnostic}`,
    );
  }
}

function commandSucceeds(cwd: string, executable: string, args: string[]): boolean {
  try {
    execFileSync(executable, args, {
      ...commandOptions,
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GH_PROMPT_DISABLED: "1",
      },
    });
    return true;
  } catch {
    return false;
  }
}

function git(cwd: string, args: string[]): string {
  return command(cwd, "git", args);
}

function gitSucceeds(cwd: string, args: string[]): boolean {
  return commandSucceeds(cwd, "git", args);
}

export function repositoryRoot(directory: string): string {
  const root = git(directory, ["rev-parse", "--show-toplevel"]);
  if (!root) {
    throw new ProjectOperationError("NOT_A_REPOSITORY", "OpenCode is not inside a Git repository.");
  }
  return realpathSync(root);
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  if (!slug) {
    throw new ProjectOperationError(
      "INVALID_TITLE",
      "The project title must contain at least one letter or number.",
    );
  }
  return slug;
}

export function parseDefaultBranch(lsRemoteOutput: string): string {
  const match = lsRemoteOutput.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD$/m);
  if (!match?.[1]) {
    throw new ProjectOperationError(
      "DEFAULT_BRANCH_UNKNOWN",
      "origin does not expose a symbolic HEAD; configure its default branch before starting a project.",
    );
  }
  return match[1];
}

export function parsePorcelain(output: string): CarriedChange[] {
  if (!output.trim()) return [];
  return output.split("\n").filter(Boolean).map((line) => {
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);
    const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)! : rawPath;
    return { status, path: unquoteGitPath(path) };
  });
}

function unquoteGitPath(path: string): string {
  if (!(path.startsWith('"') && path.endsWith('"'))) return path;
  try {
    return JSON.parse(path);
  } catch {
    return path.slice(1, -1);
  }
}

function currentBranch(root: string): string {
  const branch = git(root, ["branch", "--show-current"]);
  if (!branch) {
    throw new ProjectOperationError(
      "DETACHED_HEAD",
      "A project cannot start or publish from a detached HEAD.",
    );
  }
  return branch;
}

function branchExists(root: string, branch: string): boolean {
  return gitSucceeds(root, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]) ||
    gitSucceeds(root, ["ls-remote", "--exit-code", "--heads", "origin", branch]);
}

export function allocateProjectID(root: string, title: string): string {
  const base = slugify(title);
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const id = suffix === 1 ? base : `${base}-${suffix}`;
    if (
      !branchExists(root, `project/${id}`) &&
      !existsSync(resolve(root, PROJECTS_DIR, id))
    ) {
      return id;
    }
  }
  throw new ProjectOperationError(
    "PROJECT_ID_EXHAUSTED",
    `Could not allocate an unused project branch for "${title}".`,
  );
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function projectTemplates(result: ProjectStartResult): Record<string, string> {
  const createdAt = new Date().toISOString();
  const carriedRows = result.carriedChanges.length
    ? result.carriedChanges.map(({ status, path }) =>
      `| \`${markdownCell(path)}\` | \`${markdownCell(status)}\` | pending |`
    ).join("\n")
    : "| _None_ | — | — |";

  return {
    "plan.md": `---
project_id: ${yamlString(result.id)}
title: ${yamlString(result.title)}
status: draft
base_branch: ${yamlString(result.baseBranch)}
branch: ${yamlString(result.branch)}
created_at: ${yamlString(createdAt)}
approved_at: null
---

# Plan: ${result.title}

## Objective

_Researcher: describe the observable outcome._

## Acceptance criteria

- [ ] _Define observable acceptance criteria._

## Non-goals

- _Define explicit exclusions._

## Constraints and guardrails

- Preserve repository instructions and existing user work.

## Carried changes

Change each decision to \`adopted\` or \`unrelated\` during research. A carried path may be
committed only when it is marked \`adopted\`.

| Path | Initial status | Decision |
| --- | --- | --- |
${carriedRows}

## Research findings

_Researcher: record relevant repository authority, patterns, dependencies, and external evidence._

## Architecture and approach

_Researcher: define the implementation approach and important interfaces._

## Validation strategy

_Researcher: list exact focused checks and milestone promotion commands. Use Ayni when both
\`.ayni.toml\` and the binary are available; otherwise record the repository-native fallback._

## Milestones

### Milestone 1: _Title_

- Status: pending
- Acceptance:
  - [ ] _Milestone acceptance criterion._
- Validation:
  - \`_exact command_\`

#### Task 1.1: _Title_

- Tier: M
- Tier rationale: _Why this task fits the selected model._
- Depends on: none
- Affected responsibilities: _Components or boundaries, not only filenames._
- Expected paths: _Explicit paths or narrow directory surfaces._
- Focused checks:
  - \`_exact command_\`
`,
    "changes.md": `---
project_id: ${yamlString(result.id)}
document: changes
---

# Changes: ${result.title}

Append one section per milestone. Before \`project_commit\`, use this exact marker:
\`- Status: validated\`.

<!--
## Milestone: milestone-1

- Status: validated
- Changed responsibilities:
- Explicit paths:
- Focused checks:
- Promotion validation:
- Ayni: passed | failed | skipped
- Accepted deviations: none
-->
`,
    "result.md": `---
project_id: ${yamlString(result.id)}
status: in_progress
---

# Result: ${result.title}

## Acceptance criteria

- [ ] _Mirror every approved acceptance criterion._

## Final behavior

_Describe the delivered observable behavior._

## Architectural impact

_Describe affected boundaries and compatibility._

## Known limitations

- None recorded.

## Technical debt

- None recorded.

## Ayni

- Status: pending
- Evidence: pending

## Publication

- Draft PR: pending
`,
  };
}

function writeProjectDocuments(result: ProjectStartResult): void {
  if (existsSync(result.projectDirectory)) {
    throw new ProjectOperationError(
      "PROJECT_EXISTS",
      `Project directory already exists: ${relative(result.root, result.projectDirectory)}`,
    );
  }
  mkdirSync(dirname(result.projectDirectory), { recursive: true });
  mkdirSync(result.projectDirectory, { recursive: false });
  for (const [filename, content] of Object.entries(projectTemplates(result))) {
    writeFileSync(resolve(result.projectDirectory, filename), content);
  }
}

export function startProject(directory: string, rawTitle: string): ProjectStartResult {
  const title = rawTitle.trim();
  if (!title) {
    throw new ProjectOperationError("TITLE_REQUIRED", "A non-empty project title is required.");
  }

  const root = repositoryRoot(directory);
  if (!gitSucceeds(root, ["remote", "get-url", "origin"])) {
    throw new ProjectOperationError(
      "ORIGIN_REQUIRED",
      "The repository must have an origin remote before starting a project.",
    );
  }

  const carriedChanges = parsePorcelain(
    git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
  );
  const defaultBranch = parseDefaultBranch(git(root, ["ls-remote", "--symref", "origin", "HEAD"]));

  // Fetch first so creating a missing local default branch never relies on stale remote state.
  git(root, ["fetch", "origin", defaultBranch]);
  if (gitSucceeds(root, ["show-ref", "--verify", "--quiet", `refs/heads/${defaultBranch}`])) {
    git(root, ["switch", defaultBranch]);
  } else {
    git(root, ["switch", "--track", "-c", defaultBranch, `origin/${defaultBranch}`]);
  }
  git(root, ["pull", "--ff-only", "--no-rebase", "origin", defaultBranch]);

  const id = allocateProjectID(root, title);
  const branch = `project/${id}`;
  git(root, ["switch", "-c", branch]);

  const result: ProjectStartResult = {
    id,
    title,
    baseBranch: defaultBranch,
    branch,
    root,
    projectDirectory: resolve(root, PROJECTS_DIR, id),
    carriedChanges,
  };
  writeProjectDocuments(result);
  return result;
}

function projectPath(root: string, id: string, filename: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new ProjectOperationError("INVALID_PROJECT_ID", `Invalid project id: ${id}`);
  }
  const path = resolve(root, PROJECTS_DIR, id, filename);
  if (!existsSync(path)) {
    throw new ProjectOperationError(
      "PROJECT_DOCUMENT_MISSING",
      `Missing ${relative(root, path)}.`,
    );
  }
  return path;
}

function readProjectDocument(root: string, id: string, filename: string): string {
  return readFileSync(projectPath(root, id, filename), "utf8");
}

function metadataValue(markdown: string, key: string): string | undefined {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match?.[1]) return undefined;
  const raw = match[1].trim();
  if (raw === "null") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function requireProjectBranch(root: string, id: string): void {
  const expected = `project/${id}`;
  const actual = currentBranch(root);
  if (actual !== expected) {
    throw new ProjectOperationError(
      "WRONG_BRANCH",
      `Project ${id} requires branch ${expected}; current branch is ${actual}.`,
    );
  }
}

export function approveProject(directory: string, id: string): string {
  const root = repositoryRoot(directory);
  requireProjectBranch(root, id);
  const planPath = projectPath(root, id, "plan.md");
  const plan = readFileSync(planPath, "utf8");
  const status = metadataValue(plan, "status");
  if (status === "approved") return planPath;
  if (status !== "draft") {
    throw new ProjectOperationError(
      "PLAN_NOT_DRAFT",
      `Plan status must be draft before approval; found ${status ?? "missing"}.`,
    );
  }
  const approvedAt = new Date().toISOString();
  const approved = plan
    .replace(/^status:\s+draft$/m, "status: approved")
    .replace(/^approved_at:\s+null$/m, `approved_at: ${yamlString(approvedAt)}`);
  writeFileSync(planPath, approved);
  return planPath;
}

function validateRelativePath(root: string, path: string): string {
  if (!path || path === "." || path === ".." || isAbsolute(path) || path.includes("\0")) {
    throw new ProjectOperationError("UNSAFE_PATH", `Refusing unsafe commit path: ${path || "<empty>"}`);
  }
  const normalized = relative(root, resolve(root, path));
  if (!normalized || normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    throw new ProjectOperationError("EXTERNAL_PATH", `Commit path escapes the repository: ${path}`);
  }
  const name = basename(normalized).toLowerCase();
  const segments = normalized.toLowerCase().split(/[\\/]/);
  const secretLike =
    name === ".env" ||
    name.startsWith(".env.") ||
    name === "credentials" ||
    name.startsWith("credentials.") ||
    name === "id_rsa" ||
    name === "id_ed25519" ||
    name.endsWith(".pem") ||
    name.endsWith(".key") ||
    segments.some((segment) => segment === "secrets" || segment === ".secrets");
  if (secretLike) {
    throw new ProjectOperationError(
      "SENSITIVE_PATH",
      `Refusing credential or environment path: ${normalized}`,
    );
  }
  if (existsSync(resolve(root, normalized)) && lstatSync(resolve(root, normalized)).isDirectory()) {
    throw new ProjectOperationError(
      "DIRECTORY_PATH",
      `Commit paths must name explicit files, not directories: ${normalized}`,
    );
  }
  return normalized;
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function carriedDecision(plan: string, path: string): string | undefined {
  const escaped = regexEscape(path.replaceAll("|", "\\|"));
  const match = plan.match(
    new RegExp(`^\\|\\s*\\\`${escaped}\\\`\\s*\\|[^\\n]*\\|\\s*([^|\\s]+)\\s*\\|$`, "m"),
  );
  return match?.[1]?.toLowerCase();
}

function originalCarriedPaths(plan: string): string[] {
  const section = plan.match(/## Carried changes\s+([\s\S]*?)(?=\n## )/)?.[1] ?? "";
  const paths: string[] = [];
  for (const match of section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) {
    if (match[1]) paths.push(match[1].replaceAll("\\|", "|"));
  }
  return paths;
}

function requireValidatedMilestone(changes: string, milestone: string): void {
  const escaped = regexEscape(milestone);
  const section = changes.match(
    new RegExp(
      `^## Milestone:\\s*${escaped}\\s*$([\\s\\S]*?)(?=^## Milestone:|(?![\\s\\S]))`,
      "m",
    ),
  )?.[1];
  if (!section || !/^- Status:\s*validated\s*$/m.test(section)) {
    throw new ProjectOperationError(
      "MILESTONE_NOT_VALIDATED",
      `changes.md must contain "## Milestone: ${milestone}" with "- Status: validated".`,
    );
  }
}

export function commitProject(
  directory: string,
  input: ProjectCommitInput,
): ProjectCommitResult {
  const root = repositoryRoot(directory);
  requireProjectBranch(root, input.id);
  if (!ALLOWED_COMMIT_TYPES.has(input.type)) {
    throw new ProjectOperationError(
      "INVALID_COMMIT_TYPE",
      `Unsupported semantic commit type: ${input.type}`,
    );
  }
  const summary = input.summary.trim();
  if (!summary || summary.includes("\n") || summary.length > 72) {
    throw new ProjectOperationError(
      "INVALID_COMMIT_SUMMARY",
      "Commit summary must be one non-empty line of at most 72 characters.",
    );
  }
  if (!input.milestone.trim()) {
    throw new ProjectOperationError("MILESTONE_REQUIRED", "A milestone id is required.");
  }
  if (!input.paths.length) {
    throw new ProjectOperationError("PATHS_REQUIRED", "At least one explicit commit path is required.");
  }

  const plan = readProjectDocument(root, input.id, "plan.md");
  if (metadataValue(plan, "status") !== "approved") {
    throw new ProjectOperationError(
      "PLAN_NOT_APPROVED",
      "The plan must be explicitly approved before a milestone commit.",
    );
  }
  const changes = readProjectDocument(root, input.id, "changes.md");
  requireValidatedMilestone(changes, input.milestone);
  readProjectDocument(root, input.id, "result.md");

  const paths = [...new Set(input.paths.map((path) => validateRelativePath(root, path)))];
  const projectDocs = [
    `${PROJECTS_DIR}/${input.id}/changes.md`,
    `${PROJECTS_DIR}/${input.id}/result.md`,
  ];
  for (const required of projectDocs) {
    if (!paths.includes(required)) {
      throw new ProjectOperationError(
        "PROJECT_DOCUMENT_NOT_STAGED",
        `Every milestone commit must include ${required}.`,
      );
    }
  }
  const planRelative = `${PROJECTS_DIR}/${input.id}/plan.md`;
  if (!gitSucceeds(root, ["ls-files", "--error-unmatch", "--", planRelative]) &&
      !paths.includes(planRelative)) {
    throw new ProjectOperationError(
      "PLAN_NOT_STAGED",
      `The first milestone commit must include ${planRelative}.`,
    );
  }

  const carriedPaths = new Set(originalCarriedPaths(plan));
  for (const path of paths) {
    if (carriedPaths.has(path) && carriedDecision(plan, path) !== "adopted") {
      throw new ProjectOperationError(
        "CARRIED_PATH_NOT_ADOPTED",
        `Carried path ${path} must be marked adopted in plan.md before it can be committed.`,
      );
    }
  }

  for (const path of paths) git(root, ["add", "--", path]);
  const message = `${input.type}(${input.id}): ${summary}`;
  // --only guarantees unrelated paths that were already staged remain outside this commit.
  git(root, ["commit", "--only", "--no-gpg-sign", "-m", message, "--", ...paths]);
  return {
    revision: git(root, ["rev-parse", "HEAD"]),
    message,
    remainingChanges: parsePorcelain(
      git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    ).map(({ path }) => path),
  };
}

function requireCompletedResult(root: string, id: string): void {
  const result = readProjectDocument(root, id, "result.md");
  if (metadataValue(result, "status") !== "completed") {
    throw new ProjectOperationError(
      "RESULT_INCOMPLETE",
      "result.md status must be completed before publication.",
    );
  }
  if (/^- \[ \]/m.test(result)) {
    throw new ProjectOperationError(
      "ACCEPTANCE_INCOMPLETE",
      "Every acceptance criterion in result.md must be checked before publication.",
    );
  }
  if (!/^- Status:\s*(passed|skipped)\s*$/m.test(result)) {
    throw new ProjectOperationError(
      "VALIDATION_INCOMPLETE",
      "result.md must record Ayni or fallback validation as passed or skipped.",
    );
  }
}

export function publishProject(
  directory: string,
  input: ProjectPublishInput,
): ProjectPublishResult {
  const root = repositoryRoot(directory);
  requireProjectBranch(root, input.id);
  const plan = readProjectDocument(root, input.id, "plan.md");
  if (metadataValue(plan, "status") !== "approved") {
    throw new ProjectOperationError("PLAN_NOT_APPROVED", "Only an approved project can publish.");
  }
  requireCompletedResult(root, input.id);
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) {
    throw new ProjectOperationError(
      "DIRTY_WORKTREE",
      `Publication requires a clean working tree. Remaining changes:\n${status}`,
    );
  }

  const branch = currentBranch(root);
  const baseBranch = metadataValue(plan, "base_branch");
  if (!baseBranch) {
    throw new ProjectOperationError("BASE_BRANCH_MISSING", "plan.md has no base_branch metadata.");
  }
  command(root, "gh", ["auth", "status"]);
  git(root, ["push", "--set-upstream", "origin", branch]);

  let url: string;
  try {
    url = command(root, "gh", ["pr", "view", "--json", "url", "--jq", ".url"]);
  } catch {
    url = command(root, "gh", [
      "pr",
      "create",
      "--draft",
      "--base",
      baseBranch,
      "--head",
      branch,
      "--title",
      input.title,
      "--body",
      input.body,
    ]);
  }
  if (!/^https?:\/\//.test(url)) {
    throw new ProjectOperationError(
      "PR_URL_MISSING",
      `GitHub did not return a pull request URL: ${url || "<empty>"}`,
    );
  }
  return { branch, baseBranch, url };
}

export function sessionProjectID(directory: string): string | undefined {
  const root = repositoryRoot(directory);
  const branch = currentBranch(root);
  return branch.startsWith("project/") ? branch.slice("project/".length) : undefined;
}
