import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as project from "./project";

const roots: string[] = [];
const externalWorktrees: string[] = [];

afterEach(() => {
  for (const worktree of externalWorktrees.splice(0)) {
    rmSync(worktree, { recursive: true, force: true });
  }
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "project-runtime-"));
  roots.push(root);
  const run = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  run("init", "-b", "main");
  run("config", "user.email", "project@example.invalid");
  run("config", "user.name", "Project test");
  run("config", "commit.gpgsign", "false");
  writeFileSync(join(root, "README.md"), "fixture\n");
  run("add", "README.md");
  run("commit", "-m", "fixture");
  return root;
}

function git(base: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: base, encoding: "utf8" }).trim();
}

const taskEvidence: project.EvidenceRequirement = {
  id: "unit",
  level: "task",
  command: ["true"],
  proves: "the task is green",
  covers: ["src/a.ts"],
};

const milestoneEvidence: project.EvidenceRequirement = {
  id: "integration",
  level: "milestone",
  command: ["true"],
  proves: "the milestone is green",
  covers: ["src/**"],
};

function task(
  id = "financial-views",
  allowedPaths = ["src/a.ts"],
): project.ProjectTask {
  return {
    id,
    title: id,
    status: "ready",
    depends_on: [],
    allowed_paths: allowedPaths,
    forbidden_paths: [],
    discovery_paths: ["src/**"],
    acceptance_criteria: [`${id} is complete`],
    required_evidence: [taskEvidence],
  };
}

function milestones(): project.ProjectMilestone[] {
  return [
    {
      id: "engine-foundation",
      title: "Engine foundation",
      status: "pending",
      depends_on: [],
      acceptance_criteria: ["the engine foundation is integrated"],
      required_evidence: [milestoneEvidence],
      tasks: [task()],
    },
    {
      id: "engine-release",
      title: "Engine release",
      status: "pending",
      depends_on: ["engine-foundation"],
      acceptance_criteria: ["the engine release is verified"],
      required_evidence: [{
        ...milestoneEvidence,
        id: "release",
      }],
      tasks: [],
    },
  ];
}

function commitTask(worktree: string, path = "src/a.ts"): void {
  mkdirSync(join(worktree, "src"), { recursive: true });
  writeFileSync(join(worktree, path), "export const a = 1;\n");
  git(worktree, "add", path);
  git(
    worktree,
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "feat(engine): add view state",
  );
}

describe("milestone project runtime", () => {
  test("creates schema-v3 ignored state and a project branch", () => {
    const base = repository();
    const manifest = project.createProject(base, "income overhaul");
    expect(manifest.schema_version).toBe(3);
    expect(manifest.id).toBe("0001-income-overhaul");
    expect(manifest.integration_branch).toBe("project/0001-income-overhaul");
    expect(existsSync(join(base, ".projects", manifest.id, "project.json"))).toBe(true);
    expect(readFileSync(join(base, ".projects", ".gitignore"), "utf8"))
      .toBe("**\n!.gitignore\n");
    expect(git(base, "check-ignore", ".projects/0001-income-overhaul/project.json"))
      .toBe(".projects/0001-income-overhaul/project.json");
    expect(() => git(base, "check-ignore", ".projects/.gitignore")).toThrow();
  });

  test("runs tasks continuously and verifies at milestone boundaries", () => {
    const base = repository();
    const created = project.createProject(base, "income overhaul");
    project.setProjectPlan(base, created.id, milestones());

    let status = project.readProjectStatus(base, created.id);
    expect(status.milestones.map((item) => item.status)).toEqual(["active", "pending"]);
    expect(status.ready_tasks.map((item) => item.id)).toEqual(["financial-views"]);

    const dispatched = project.dispatchProjectTask(base, created.id, "financial-views");
    const running = dispatched.milestones[0]!.tasks[0]!;
    externalWorktrees.push(running.worktree!);
    commitTask(running.worktree!);
    const taskResult = project.verifyProjectTaskRequirement(
      base,
      created.id,
      "financial-views",
      "unit",
    );
    expect(taskResult.evidence.result).toBe("pass");
    project.markProjectTaskVerified(base, created.id, "financial-views");

    git(base, "config", "commit.gpgsign", "true");
    git(base, "config", "gpg.program", "/usr/bin/false");
    project.mergeProjectTask(base, created.id, "financial-views");

    status = project.readProjectStatus(base, created.id);
    expect(status.milestones[0]?.status).toBe("verifying");
    const firstGate = project.verifyProjectMilestone(
      base,
      created.id,
      "engine-foundation",
    );
    expect(firstGate.result).toBe("pass");
    expect(firstGate.manifest.milestones[1]?.status).toBe("verifying");

    const secondGate = project.verifyProjectMilestone(
      base,
      created.id,
      "engine-release",
    );
    expect(secondGate.result).toBe("pass");
    const closed = project.closeProject(base, created.id, "all milestones passed");
    expect(closed.status).toBe("done");
    expect(closed.milestones.every((item) => item.status === "verified")).toBe(true);
  });

  test("corrects a failed milestone gate in place", () => {
    const base = repository();
    const created = project.createProject(base, "gate recovery");
    const plan = milestones();
    plan[0]!.tasks = [];
    plan[0]!.required_evidence = [{
      ...milestoneEvidence,
      command: ["false"],
      timeout_ms: 1_000,
    }];
    plan.splice(1);
    project.setProjectPlan(base, created.id, plan);

    const failed = project.verifyProjectMilestone(
      base,
      created.id,
      "engine-foundation",
    );
    expect(failed.result).toBe("fail");
    expect(failed.manifest.milestones[0]?.status).toBe("verifying");

    project.updateEvidenceRequirement(
      base,
      created.id,
      "milestone",
      "engine-foundation",
      { ...milestoneEvidence, command: ["true"], timeout_ms: 900_000 },
      "correct the gate command and realistic timeout",
    );
    const passed = project.verifyProjectMilestone(
      base,
      created.id,
      "engine-foundation",
    );
    expect(passed.result).toBe("pass");
    expect(passed.manifest.decisions).toHaveLength(0);
    expect(passed.manifest.evidence.filter((item) => item.invalidated_at)).toHaveLength(1);
  });

  test("preserves attempts and skips stale branch collisions", () => {
    const base = repository();
    const created = project.createProject(base, "attempt recovery");
    const plan = milestones();
    plan.splice(1);
    project.setProjectPlan(base, created.id, plan);

    const first = project.dispatchProjectTask(base, created.id, "financial-views");
    externalWorktrees.push(first.milestones[0]!.tasks[0]!.worktree!);
    project.requeueProjectTask(
      base,
      created.id,
      "financial-views",
      "clean operational retry",
    );
    const replacement = task();
    project.updateProjectTask(
      base,
      created.id,
      "engine-foundation",
      replacement,
      "clarify the task contract",
    );
    const second = project.dispatchProjectTask(base, created.id, "financial-views");
    const retried = second.milestones[0]!.tasks[0]!;
    externalWorktrees.push(retried.worktree!);
    expect(retried.attempt).toBe(2);
    expect(retried.branch).toEndWith("-2");
  });

  test("returns compact status instead of the evidence and decision history", () => {
    const base = repository();
    const created = project.createProject(base, "compact state");
    project.setProjectPlan(base, created.id, milestones());
    project.recordProjectDecision(base, created.id, "Chosen behavior", "material reason");
    const status = project.readProjectStatus(base, created.id);
    expect(status).not.toHaveProperty("evidence");
    expect(status).not.toHaveProperty("decisions");
    expect(status.ready_tasks[0]?.id).toBe("financial-views");
    expect(JSON.stringify(status).length).toBeLessThan(5_000);
  });

  test("rejects cross-milestone task dependencies and overlapping active writes", () => {
    const base = repository();
    const created = project.createProject(base, "safe graph");
    const invalid = milestones();
    invalid[1]!.tasks = [{
      ...task("release-task", ["src/b.ts"]),
      depends_on: ["financial-views"],
      required_evidence: [{ ...taskEvidence, id: "release-unit" }],
    }];
    expect(() => project.setProjectPlan(base, created.id, invalid))
      .toThrow("outside milestone");

    const safeBase = repository();
    const safeCreated = project.createProject(safeBase, "overlap graph");
    const plan = milestones();
    plan.splice(1);
    plan[0]!.tasks.push({
      ...task("other", ["src/**"]),
      required_evidence: [{ ...taskEvidence, id: "other-unit" }],
    });
    project.setProjectPlan(safeBase, safeCreated.id, plan);
    const first = project.dispatchProjectTask(
      safeBase,
      safeCreated.id,
      "financial-views",
    );
    externalWorktrees.push(first.milestones[0]!.tasks[0]!.worktree!);
    expect(() => project.dispatchProjectTask(safeBase, safeCreated.id, "other"))
      .toThrow("overlaps");
  });

  test("refuses unsafe evidence and post-verification changes", () => {
    const base = repository();
    const created = project.createProject(base, "safe verification");
    const plan = milestones();
    plan.splice(1);
    plan[0]!.tasks[0]!.required_evidence = [{
      ...taskEvidence,
      command: ["/bin/rm", "-rf", "build"],
    }];
    project.setProjectPlan(base, created.id, plan);
    const dispatched = project.dispatchProjectTask(base, created.id, "financial-views");
    const running = dispatched.milestones[0]!.tasks[0]!;
    externalWorktrees.push(running.worktree!);
    expect(() =>
      project.verifyProjectTaskRequirement(base, created.id, "financial-views", "unit")
    ).toThrow("Unsafe evidence");

    const safeBase = repository();
    const safeCreated = project.createProject(safeBase, "post verification");
    const safePlan = milestones();
    safePlan.splice(1);
    project.setProjectPlan(safeBase, safeCreated.id, safePlan);
    const safeDispatch = project.dispatchProjectTask(
      safeBase,
      safeCreated.id,
      "financial-views",
    );
    const safeTask = safeDispatch.milestones[0]!.tasks[0]!;
    externalWorktrees.push(safeTask.worktree!);
    commitTask(safeTask.worktree!);
    project.verifyProjectTaskRequirement(
      safeBase,
      safeCreated.id,
      "financial-views",
      "unit",
    );
    project.markProjectTaskVerified(safeBase, safeCreated.id, "financial-views");
    writeFileSync(join(safeTask.worktree!, "src/a.ts"), "export const a = 2;\n");
    git(safeTask.worktree!, "add", "src/a.ts");
    git(
      safeTask.worktree!,
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "feat: changed later",
    );
    expect(() =>
      project.mergeProjectTask(safeBase, safeCreated.id, "financial-views")
    ).toThrow("changed after verification");
  });

  test("rejects old project schemas instead of carrying them forward", () => {
    const base = repository();
    mkdirSync(join(base, ".projects", "0001-old"), { recursive: true });
    writeFileSync(
      join(base, ".projects", "0001-old", "project.json"),
      `${JSON.stringify({ schema_version: 2 })}\n`,
    );
    expect(() => project.readProjectManifest(base, "0001-old"))
      .toThrow("unsupported schema 2");
    expect(project.listProjects(base)).toEqual([]);
  });
});
