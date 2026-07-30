import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  allocateProjectID,
  approveProject,
  commitProject,
  parseDefaultBranch,
  parsePorcelain,
  ProjectOperationError,
  publishProject,
  slugify,
  startProject,
} from "./project.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(cwd: string, executable: string, args: string[]): string {
  return execFileSync(executable, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ADE Test",
      GIT_AUTHOR_EMAIL: "ade@example.test",
      GIT_COMMITTER_NAME: "ADE Test",
      GIT_COMMITTER_EMAIL: "ade@example.test",
    },
  }).trim();
}

function write(path: string, content: string): void {
  writeFileSync(path, content);
}

interface Fixture {
  root: string;
  origin: string;
  work: string;
}

function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "opencode-ade-test-"));
  temporaryDirectories.push(root);
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const work = join(root, "work");

  mkdirSync(seed);
  run(root, "git", ["init", "--bare", "--initial-branch=main", origin]);
  run(seed, "git", ["init", "-b", "main"]);
  run(seed, "git", ["config", "user.name", "ADE Test"]);
  run(seed, "git", ["config", "user.email", "ade@example.test"]);
  run(seed, "git", ["config", "commit.gpgsign", "false"]);
  write(join(seed, "app.txt"), "initial\n");
  run(seed, "git", ["add", "app.txt"]);
  run(seed, "git", ["commit", "-m", "initial"]);
  run(seed, "git", ["remote", "add", "origin", origin]);
  run(seed, "git", ["push", "-u", "origin", "main"]);

  run(root, "git", ["clone", origin, work]);
  run(work, "git", ["config", "user.name", "ADE Test"]);
  run(work, "git", ["config", "user.email", "ade@example.test"]);
  run(work, "git", ["config", "commit.gpgsign", "false"]);
  return { root, origin, work };
}

function prepareApprovedMilestone(work: string, id: string, complete = false): string[] {
  approveProject(work, id);
  const projectDirectory = join(work, ".projects", id);
  const changesPath = join(projectDirectory, "changes.md");
  write(
    changesPath,
    `${readFileSync(changesPath, "utf8")}

## Milestone: milestone-1

- Status: validated
- Changed responsibilities: fixture
- Explicit paths: app.txt
- Focused checks: passed
- Promotion validation: passed
- Ayni: skipped
- Accepted deviations: none
`,
  );
  const resultPath = join(projectDirectory, "result.md");
  let result = readFileSync(resultPath, "utf8");
  if (complete) {
    result = result
      .replace("status: in_progress", "status: completed")
      .replace("- [ ] _Mirror", "- [x] _Mirror")
      .replace("- Status: pending", "- Status: skipped")
      .replace("- Evidence: pending", "- Evidence: repository-native validation passed");
  }
  write(resultPath, result);
  return [
    `.projects/${id}/plan.md`,
    `.projects/${id}/changes.md`,
    `.projects/${id}/result.md`,
  ];
}

describe("project primitives", () => {
  test("normalizes titles and parses remote HEAD", () => {
    expect(slugify("  Add OAuth 2.0 / Login  ")).toBe("add-oauth-2-0-login");
    expect(parseDefaultBranch("ref: refs/heads/trunk\tHEAD\nabc\tHEAD")).toBe("trunk");
  });

  test("parses staged, untracked, and renamed porcelain paths", () => {
    expect(parsePorcelain("M  staged.txt\n?? new.txt\nR  old.txt -> moved.txt")).toEqual([
      { status: "M ", path: "staged.txt" },
      { status: "??", path: "new.txt" },
      { status: "R ", path: "moved.txt" },
    ]);
  });
});

describe("project_start", () => {
  test("preserves carried changes and scaffolds living documents", () => {
    const { work } = fixture();
    write(join(work, "app.txt"), "changed\n");
    write(join(work, "staged.txt"), "staged\n");
    write(join(work, "untracked.txt"), "untracked\n");
    run(work, "git", ["add", "staged.txt"]);

    const result = startProject(work, "Account recovery");

    expect(result.branch).toBe("project/account-recovery");
    expect(run(work, "git", ["branch", "--show-current"])).toBe(result.branch);
    expect(readFileSync(join(work, "app.txt"), "utf8")).toBe("changed\n");
    expect(readFileSync(join(work, "staged.txt"), "utf8")).toBe("staged\n");
    expect(readFileSync(join(work, "untracked.txt"), "utf8")).toBe("untracked\n");
    const plan = readFileSync(join(result.projectDirectory, "plan.md"), "utf8");
    expect(plan).toContain("status: draft");
    expect(plan).toContain("`app.txt`");
    expect(plan).toContain("`staged.txt`");
    expect(plan).toContain("`untracked.txt`");
  });

  test("uses deterministic numeric suffixes for collisions", () => {
    const { work } = fixture();
    run(work, "git", ["branch", "project/collision"]);
    expect(allocateProjectID(work, "Collision")).toBe("collision-2");
    expect(startProject(work, "Collision").id).toBe("collision-2");
  });

  test("stops without overwriting dirty work when pull conflicts", () => {
    const { root, origin, work } = fixture();
    const other = join(root, "other");
    run(root, "git", ["clone", origin, other]);
    run(other, "git", ["config", "user.name", "ADE Test"]);
    run(other, "git", ["config", "user.email", "ade@example.test"]);
    run(other, "git", ["config", "commit.gpgsign", "false"]);
    write(join(other, "app.txt"), "remote\n");
    run(other, "git", ["add", "app.txt"]);
    run(other, "git", ["commit", "-m", "remote"]);
    run(other, "git", ["push", "origin", "main"]);

    write(join(work, "app.txt"), "local\n");
    expect(() => startProject(work, "Conflict")).toThrow(ProjectOperationError);
    expect(readFileSync(join(work, "app.txt"), "utf8")).toBe("local\n");
    expect(run(work, "git", ["branch", "--show-current"])).toBe("main");
  });
});

describe("approval and milestone commits", () => {
  test("records approval and commits only explicit adopted paths", () => {
    const { work } = fixture();
    write(join(work, "unrelated.txt"), "keep staged\n");
    run(work, "git", ["add", "unrelated.txt"]);
    const project = startProject(work, "Explicit commit");
    const planPath = join(project.projectDirectory, "plan.md");
    write(
      planPath,
      readFileSync(planPath, "utf8").replace(
        "| `unrelated.txt` | `A ` | pending |",
        "| `unrelated.txt` | `A ` | unrelated |",
      ),
    );
    write(join(work, "feature.txt"), "implemented\n");
    const docs = prepareApprovedMilestone(work, project.id);

    const result = commitProject(work, {
      id: project.id,
      milestone: "milestone-1",
      paths: [...docs, "feature.txt"],
      type: "feat",
      summary: "deliver explicit fixture",
    });

    expect(result.message).toBe(
      `feat(${project.id}): deliver explicit fixture`,
    );
    expect(run(work, "git", ["show", "--format=", "--name-only", "HEAD"]).split("\n")).toContain(
      "feature.txt",
    );
    expect(run(work, "git", ["show", "--format=", "--name-only", "HEAD"])).not.toContain(
      "unrelated.txt",
    );
    expect(run(work, "git", ["status", "--porcelain"])).toContain("A  unrelated.txt");
  });

  test("rejects carried paths until research marks them adopted", () => {
    const { work } = fixture();
    write(join(work, "carried.txt"), "carried\n");
    const project = startProject(work, "Adoption gate");
    const docs = prepareApprovedMilestone(work, project.id);

    expect(() =>
      commitProject(work, {
        id: project.id,
        milestone: "milestone-1",
        paths: [...docs, "carried.txt"],
        type: "feat",
        summary: "incorrectly include carried work",
      })
    ).toThrow("must be marked adopted");
  });

  test("rejects environment, credential, directory, and escaping paths", () => {
    const { work } = fixture();
    const project = startProject(work, "Path guard");
    const docs = prepareApprovedMilestone(work, project.id);
    for (const unsafe of [".env", "keys/private.pem", ".", "../outside"]) {
      expect(() =>
        commitProject(work, {
          id: project.id,
          milestone: "milestone-1",
          paths: [...docs, unsafe],
          type: "test",
          summary: "exercise path guard",
        })
      ).toThrow(ProjectOperationError);
    }
  });
});

describe("project_publish", () => {
  test("requires a clean completed project and creates a draft PR", () => {
    const { root, work } = fixture();
    const project = startProject(work, "Publish fixture");
    write(join(work, "feature.txt"), "done\n");
    const docs = prepareApprovedMilestone(work, project.id, true);
    commitProject(work, {
      id: project.id,
      milestone: "milestone-1",
      paths: [...docs, "feature.txt"],
      type: "feat",
      summary: "complete publication fixture",
    });

    const bin = join(root, "bin");
    const log = join(root, "gh.log");
    mkdirSync(bin);
    const gh = join(bin, "gh");
    write(
      gh,
      `#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG"
if [ "$1" = "auth" ]; then exit 0; fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then exit 1; fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  echo "https://github.example.test/org/repo/pull/1"
  exit 0
fi
exit 1
`,
    );
    chmodSync(gh, 0o755);
    const originalPath = process.env.PATH;
    process.env.PATH = `${bin}:${originalPath}`;
    process.env.GH_LOG = log;
    try {
      const published = publishProject(work, {
        id: project.id,
        title: "Publish fixture",
        body: "Validated fixture.",
      });
      expect(published.url).toBe("https://github.example.test/org/repo/pull/1");
      expect(readFileSync(log, "utf8")).toContain("pr create --draft");
      expect(run(work, "git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]))
        .toBe(`origin/${project.branch}`);
    } finally {
      process.env.PATH = originalPath;
      delete process.env.GH_LOG;
    }
  });

  test("blocks publication while unrelated carried work remains", () => {
    const { work } = fixture();
    write(join(work, "unrelated.txt"), "unrelated\n");
    const project = startProject(work, "Dirty publication");
    const planPath = join(project.projectDirectory, "plan.md");
    write(
      planPath,
      readFileSync(planPath, "utf8").replace(
        "| `unrelated.txt` | `??` | pending |",
        "| `unrelated.txt` | `??` | unrelated |",
      ),
    );
    write(join(work, "feature.txt"), "done\n");
    const docs = prepareApprovedMilestone(work, project.id, true);
    commitProject(work, {
      id: project.id,
      milestone: "milestone-1",
      paths: [...docs, "feature.txt"],
      type: "feat",
      summary: "complete dirty fixture",
    });

    expect(() =>
      publishProject(work, {
        id: project.id,
        title: "Dirty publication",
        body: "Should not publish.",
      })
    ).toThrow("clean working tree");
  });
});
