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
import { dirname, join } from "node:path";
import * as project from "./project";
import * as projectTools from "../tools/project";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(base: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: base, encoding: "utf8" }).trim();
}

function repository(files: Record<string, string> = {}): string {
  const container = mkdtempSync(join(tmpdir(), "project-v5-"));
  const root = join(container, "repository");
  mkdirSync(root);
  roots.push(container);
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "project@example.invalid");
  git(root, "config", "user.name", "Project fixture");
  git(root, "config", "commit.gpgsign", "false");
  writeFileSync(join(root, "README.md"), "fixture\n");
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture");
  return root;
}

function command(id: string, source = "process.exit(0)"): project.ValidationCommand {
  return { id, command: ["node", "-e", source], proves: `${id} passes` };
}

function task(
  id: string,
  tier: project.ImplementationTier = "m",
  surfaces = [`src/${id}.ts`],
  parallelGroup?: string,
): project.ProjectTaskInput {
  return {
    id,
    title: `Implement ${id}`,
    implementation_tier: tier,
    tier_rationale: `${tier.toUpperCase()} is proportionate to this change`,
    depends_on: [],
    expected_surfaces: surfaces,
    focused_checks: [command(`${id}-focused`)],
    parallel_group: parallelGroup,
  };
}

function milestone(
  tasks: project.ProjectTaskInput[] = [task("change")],
  validation: project.ValidationCommand[] = [command("milestone")],
): project.ProjectMilestoneInput {
  return {
    id: "delivery",
    title: "Delivery",
    acceptance_criteria: ["The integrated behavior is proven"],
    tasks,
    validation,
  };
}

function approve(
  base: string,
  milestones: project.ProjectMilestoneInput[] = [milestone()],
): project.ProjectManifest {
  const created = project.createProject(base, "autonomous delivery");
  return project.setProjectPlan(base, created.id, {
    objective: {
      outcome: "Deliver the approved behavior",
      acceptance_criteria: ["The behavior is observable"],
      non_goals: ["Unrelated redesign"],
      guardrails: ["Follow repository policy"],
    },
    milestones,
    approved: true,
  });
}

function commit(worktree: string, path: string, content = "export const done = true;\n"): string {
  mkdirSync(dirname(join(worktree, path)), { recursive: true });
  writeFileSync(join(worktree, path), content);
  git(worktree, "add", path);
  git(worktree, "commit", "-m", `feat: ${path}`);
  return git(worktree, "rev-parse", "HEAD");
}

function focused(taskId: string): project.FocusedCheckReport[] {
  return [{
    requirement_id: `${taskId}-focused`,
    result: "pass",
    command: ["node", "-e", "process.exit(0)"],
    duration_ms: 1,
  }];
}

describe("schema-v5 lifecycle", () => {
  test("lists only v5 projects and creates an ignored design record", () => {
    const base = repository();
    mkdirSync(join(base, ".projects", "legacy"), { recursive: true });
    writeFileSync(
      join(base, ".projects", "legacy", "project.json"),
      `${JSON.stringify({ schema_version: 4, id: "legacy" })}\n`,
    );

    const created = project.createProject(base, "Fresh Project");
    expect(created.schema_version).toBe(5);
    expect(created.status).toBe("design");
    expect(project.listProjects(base).map((item) => item.id)).toEqual([created.id]);
    expect(() => project.resolveProject(base, "legacy")).toThrow("schema-v5");
    expect(git(base, "check-ignore", `.projects/${created.id}/project.json`))
      .toBe(`.projects/${created.id}/project.json`);
  });

  test("initial approval creates one cumulative project worktree", () => {
    const base = repository();
    const manifest = approve(base);
    expect(manifest.status).toBe("active");
    expect(manifest.project_branch).toBe(`project/${manifest.id}`);
    expect(manifest.project_worktree).toBeTruthy();
    expect(existsSync(manifest.project_worktree!)).toBe(true);
    expect(git(manifest.project_worktree!, "branch", "--show-current"))
      .toBe(manifest.project_branch);
    expect(manifest.milestones[0]?.status).toBe("active");
    expect(project.readProjectStatus(base, manifest.id).next_action)
      .toContain("Start task change");
  });

  test("the first draft plan creates the branch before user approval", () => {
    const base = repository();
    const created = project.createProject(base, "planned branch");
    const objective: project.ProjectObjective = {
      outcome: "Deliver the planned behavior",
      acceptance_criteria: ["The behavior is observable"],
      non_goals: [],
      guardrails: [],
    };
    const draft = project.setProjectPlan(base, created.id, {
      objective,
      milestones: [milestone()],
      rationale: "Initial plan ready for review",
      approved: false,
    });
    expect(draft.status).toBe("design");
    expect(draft.plan_revision).toBe(1);
    expect(draft.plan_history[0]?.approved).toBe(false);
    expect(draft.project_worktree).toBeTruthy();
    expect(git(draft.project_worktree!, "branch", "--show-current"))
      .toBe(draft.project_branch);

    const approved = project.setProjectPlan(base, created.id, {
      objective,
      milestones: [milestone()],
      rationale: "User approved the draft",
      approved: true,
    });
    expect(approved.status).toBe("active");
    expect(approved.project_worktree).toBe(draft.project_worktree);
    expect(approved.plan_revision).toBe(2);
  });

  test("task-plan changes inside the active milestone need no approval", () => {
    const base = repository();
    const manifest = approve(base);
    const revised = project.setProjectPlan(base, manifest.id, {
      objective: manifest.objective!,
      milestones: [milestone([task("change"), task("follow-up", "s")])],
      rationale: "Discovery split the local work into two clearer steps",
    });
    expect(revised.status).toBe("active");
    expect(revised.plan_revision).toBe(2);
    expect(revised.milestones[0]?.tasks.map((item) => item.id))
      .toEqual(["change", "follow-up"]);
  });

  test("a new milestone waits for approval and resumes without replacing work", () => {
    const base = repository();
    const manifest = approve(base);
    const waiting = project.setProjectPlan(base, manifest.id, {
      objective: manifest.objective!,
      milestones: [
        milestone(),
        { ...milestone([task("later")]), id: "later", title: "Later" },
      ],
      rationale: "A newly discovered responsibility requires another outcome gate",
    });
    expect(waiting.status).toBe("waiting");
    expect(waiting.waiting?.kind).toBe("plan_approval");

    const resumed = project.setProjectPlan(base, manifest.id, {
      objective: manifest.objective!,
      milestones: [
        milestone(),
        { ...milestone([task("later")]), id: "later", title: "Later" },
      ],
      approved: true,
      rationale: "User approved the milestone revision",
    });
    expect(resumed.status).toBe("active");
    expect(resumed.project_worktree).toBe(manifest.project_worktree);
  });
});

describe("adaptive execution", () => {
  test("S to M to L escalation preserves the same worktree and partial edits", () => {
    const base = repository();
    const manifest = approve(base, [milestone([task("small", "s")])]);
    const handle = project.startProjectTasks(base, manifest.id)[0]!;
    mkdirSync(join(handle.worktree, "src"), { recursive: true });
    writeFileSync(join(handle.worktree, "src/small.ts"), "partial\n");

    const medium = project.reportProject(base, manifest.id, {
      kind: "tier_mismatch",
      task_id: "small",
      rationale: "The behavior spans a component boundary",
    });
    const large = project.reportProject(base, manifest.id, {
      kind: "tier_mismatch",
      task_id: "small",
      rationale: "The contract requires architectural reasoning",
    });
    expect(medium.task?.implementation_tier).toBe("m");
    expect(large.task?.implementation_tier).toBe("l");
    expect(large.handle?.worktree).toBe(handle.worktree);
    expect(readFileSync(join(handle.worktree, "src/small.ts"), "utf8")).toBe("partial\n");
  });

  test("research and local environment scope expansion resume the same task", () => {
    const base = repository();
    const manifest = approve(base);
    const handle = project.startProjectTasks(base, manifest.id)[0]!;
    project.reportProject(base, manifest.id, {
      kind: "research_needed",
      task_id: "change",
      rationale: "Need authoritative API behavior",
    });
    const scoped = project.reportProject(base, manifest.id, {
      kind: "scope_review",
      task_id: "change",
      assessment: {
        necessary: true,
        impact: "Repairs the local Docker readiness check",
        affected_responsibilities: ["development environment"],
        local_alternatives: ["none that preserve the milestone"],
        compatibility: "No production behavior change",
        category: "local_prerequisite",
        added_surfaces: ["docker-compose.yml"],
      },
    });
    expect(scoped.manifest.status).toBe("active");
    expect(scoped.task?.status).toBe("running");
    expect(scoped.task?.expected_surfaces).toContain("docker-compose.yml");
    expect(scoped.handle?.worktree).toBe(handle.worktree);
  });

  test("user questions wait and answers resume the same running task", () => {
    const base = repository();
    const manifest = approve(base);
    const handle = project.startProjectTasks(base, manifest.id)[0]!;
    const waiting = project.reportProject(base, manifest.id, {
      kind: "needs_user",
      task_id: "change",
      question: "Which observable behavior is authoritative?",
      rationale: "The repository policies conflict",
    });
    expect(waiting.manifest.status).toBe("waiting");
    const resumed = project.reportProject(base, manifest.id, {
      kind: "user_answer",
      answer: "Preserve the public contract",
    });
    expect(resumed.manifest.status).toBe("active");
    expect(resumed.task?.status).toBe("running");
    expect(resumed.handle?.worktree).toBe(handle.worktree);
  });

  test("focused checks are recorded and implementation commits on the project worktree", () => {
    const base = repository();
    const manifest = approve(base);
    const handle = project.startProjectTasks(base, manifest.id)[0]!;
    const revision = commit(handle.worktree, "src/change.ts");
    const result = project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "change",
      revision,
      focused_checks: [{
        requirement_id: "change-focused",
        result: "pass",
        command: ["node", "-e", "process.exit(0)"],
        duration_ms: 4,
      }],
    });
    expect(result.task?.status).toBe("committed");
    expect(result.task?.focused_check_reports).toHaveLength(1);
    expect(result.manifest.milestones[0]?.status).toBe("active");
  });

  test("a stale reported revision reconciles to the clean assigned worktree HEAD", () => {
    const base = repository();
    const manifest = approve(base);
    const handle = project.startProjectTasks(base, manifest.id)[0]!;
    const reported = commit(handle.worktree, "src/change.ts");
    const actual = commit(handle.worktree, "src/follow-up.ts");
    const result = project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "change",
      revision: reported,
      focused_checks: focused("change"),
    });
    expect(result.task?.status).toBe("committed");
    expect(result.task?.revision).toBe(actual);
    expect(result.manifest.project_revision).toBe(actual);
    expect(result.manifest.events.some((event) =>
      event.kind === "revision_reconciled"
    )).toBe(true);
  });
});

describe("parallel composition", () => {
  test("independent tasks get temporary worktrees and compose into the project worktree", () => {
    const base = repository();
    const manifest = approve(base, [
      milestone([
        task("left", "m", ["src/left.ts"], "pair"),
        task("right", "m", ["src/right.ts"], "pair"),
      ]),
    ]);
    const handles = project.startProjectTasks(base, manifest.id);
    expect(handles).toHaveLength(2);
    expect(new Set(handles.map((item) => item.worktree)).size).toBe(2);
    for (const handle of handles) {
      const revision = commit(handle.worktree, `src/${handle.task_id}.ts`);
      project.reportProject(base, manifest.id, {
        kind: "implemented",
        task_id: handle.task_id,
        revision,
        focused_checks: focused(handle.task_id),
      });
    }
    const current = project.readProjectManifest(base, manifest.id);
    expect(current.milestones[0]?.tasks.every((item) => item.status === "committed"))
      .toBe(true);
    expect(existsSync(join(current.project_worktree!, "src/left.ts"))).toBe(true);
    expect(existsSync(join(current.project_worktree!, "src/right.ts"))).toBe(true);
  });

  test("overlapping actual changes safely serialize the remaining task", () => {
    const base = repository({ "shared.txt": "base\n" });
    const manifest = approve(base, [
      milestone([
        task("left", "m", ["src/left.ts"], "pair"),
        task("right", "m", ["src/right.ts"], "pair"),
      ]),
    ]);
    const [left, right] = project.startProjectTasks(base, manifest.id);
    commit(left!.worktree, "shared.txt", "left\n");
    commit(right!.worktree, "shared.txt", "right\n");
    project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "left",
      revision: git(left!.worktree, "rev-parse", "HEAD"),
      focused_checks: focused("left"),
    });
    const fallback = project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "right",
      revision: git(right!.worktree, "rev-parse", "HEAD"),
      focused_checks: focused("right"),
    });
    expect(fallback.task?.status).toBe("pending");
    expect(fallback.task?.parallel_group).toBeUndefined();
    expect(fallback.manifest.events.at(-1)?.kind).toBe("parallel_serialized");
    expect(git(fallback.manifest.project_worktree!, "status", "--porcelain")).toBe("");
  });

  test("scope expansion into another task's responsibility stops parallel execution", () => {
    const base = repository();
    const manifest = approve(base, [
      milestone([
        task("left", "m", ["src/left.ts"], "pair"),
        task("right", "m", ["src/right.ts"], "pair"),
      ]),
    ]);
    project.startProjectTasks(base, manifest.id);
    const result = project.reportProject(base, manifest.id, {
      kind: "scope_review",
      task_id: "left",
      assessment: {
        necessary: true,
        impact: "The invariant also owns the right-hand module",
        affected_responsibilities: ["left", "right"],
        local_alternatives: ["Duplicate the invariant, which is unsafe"],
        compatibility: "Preserves the approved behavior",
        category: "objective",
        added_surfaces: ["src/right.ts"],
      },
    });
    const tasks = result.manifest.milestones[0]!.tasks;
    expect(tasks.every((item) => item.parallel_group === undefined)).toBe(true);
    expect(tasks.every((item) => item.status === "running")).toBe(true);
    expect(result.manifest.events.at(-1)?.kind).toBe("parallel_serialized");
    expect(git(result.manifest.project_worktree!, "status", "--porcelain")).toBe("");
  });
});

describe("foreground milestone validation", () => {
  test("fixture Project recovers through sequential, decision, parallel, and publication flow", async () => {
    const base = repository();
    const first: project.ProjectMilestoneInput = {
      ...milestone(
        [task("sequential")],
        [command(
          "first-gate",
          "process.exit(require('fs').existsSync('repair.flag') ? 0 : 9)",
        )],
      ),
      id: "first",
      title: "First",
    };
    const second: project.ProjectMilestoneInput = {
      ...milestone([
        task("parallel-left", "m", ["src/parallel-left.ts"], "pair"),
        task("parallel-right", "m", ["src/parallel-right.ts"], "pair"),
      ]),
      id: "second",
      title: "Second",
    };
    const manifest = approve(base, [first, second]);

    const sequential = project.startProjectTasks(base, manifest.id)[0]!;
    project.reportProject(base, manifest.id, {
      kind: "needs_user",
      task_id: "sequential",
      question: "Confirm the public behavior",
      rationale: "Two repository policies disagree",
    });
    project.reportProject(base, manifest.id, {
      kind: "user_answer",
      answer: "Preserve the public behavior",
    });
    project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "sequential",
      revision: commit(sequential.worktree, "src/sequential.ts"),
      focused_checks: focused("sequential"),
    });

    const failed = await project.validateProject(base, manifest.id);
    expect(failed.result).toBe("failed");
    expect(failed.manifest.milestones[0]!.tasks[0]!.status).toBe("running");
    project.reportProject(base, manifest.id, {
      kind: "implemented",
      task_id: "sequential",
      revision: commit(sequential.worktree, "repair.flag", "fixed\n"),
      focused_checks: focused("sequential"),
    });
    expect((await project.validateProject(base, manifest.id)).result).toBe("passed");

    for (const parallel of project.startProjectTasks(base, manifest.id)) {
      project.reportProject(base, manifest.id, {
        kind: "implemented",
        task_id: parallel.task_id,
        revision: commit(parallel.worktree, `src/${parallel.task_id}.ts`),
        focused_checks: focused(parallel.task_id),
      });
    }
    const done = await project.validateProject(base, manifest.id, {
      publish: async () => ({ url: "https://example.invalid/pr/fixture" }),
    });
    expect(done.result).toBe("done");
    expect(done.manifest.milestones.every((item) => item.status === "validated"))
      .toBe(true);
    expect(done.manifest.draft_pr_url).toBe("https://example.invalid/pr/fixture");
  });

  test("failure remains active, records a stable fingerprint, and reruns without repair state", async () => {
    const base = repository();
    const gate = command(
      "gate",
      "process.stderr.write('stable failure\\n');process.exit(require('fs').existsSync('fixed')?0:7)",
    );
    const manifest = approve(base, [milestone([], [gate])]);
    const first = await project.validateProject(base, manifest.id);
    const second = await project.validateProject(base, manifest.id);
    expect(first.result).toBe("failed");
    expect(second.result).toBe("failed");
    expect(first.evidence?.failure_fingerprint)
      .toBe(second.evidence?.failure_fingerprint);
    expect(second.manifest.status).toBe("active");
    expect(JSON.stringify(second.manifest)).not.toContain("repairing");

    writeFileSync(join(second.manifest.project_worktree!, "fixed"), "yes\n");
    git(second.manifest.project_worktree!, "add", "fixed");
    git(second.manifest.project_worktree!, "commit", "-m", "fix: gate");
    const passed = await project.validateProject(base, manifest.id, {
      publish: async () => ({ url: "https://example.invalid/pr/1" }),
    });
    expect(passed.result).toBe("done");
    expect(passed.manifest.draft_pr_url).toBe("https://example.invalid/pr/1");
  });

  test("an unchanged unrelated baseline continues only after policy acceptance", async () => {
    const base = repository();
    const gate = command(
      "known-baseline",
      "process.stderr.write('known baseline\\n');process.exit(6)",
    );
    const manifest = approve(base, [milestone([], [gate])]);
    const failed = await project.validateProject(base, manifest.id);
    expect(failed.evidence?.baseline_comparison).toBe("unchanged");

    project.reportProject(base, manifest.id, {
      kind: "baseline_assessment",
      milestone_id: "delivery",
      requirement_id: "known-baseline",
      fingerprint: failed.evidence!.failure_fingerprint!,
      classification: "unchanged_unrelated",
      repository_policy_allows: true,
      rationale: "Repository policy permits this unrelated pre-existing failure",
    });
    const completed = await project.validateProject(base, manifest.id, {
      publish: async () => ({ url: "https://example.invalid/pr/baseline" }),
    });
    expect(completed.result).toBe("done");
    expect(completed.manifest.validation_runs.at(-1)?.[0]?.result)
      .toBe("accepted_baseline");
  });

  test("a timed-out validation is bounded and safely rerunnable", async () => {
    const base = repository();
    const gate = command("slow", "setInterval(()=>{},1000)");
    gate.timeout_ms = 100;
    const manifest = approve(base, [milestone([], [gate])]);
    const first = await project.validateProject(base, manifest.id);
    const second = await project.validateProject(base, manifest.id);
    expect(first.result).toBe("failed");
    expect(first.evidence?.diagnostic_tail).toContain("timed out after 100ms");
    expect(second.result).toBe("failed");
    expect(project.readProjectManifest(base, manifest.id).validation_runs).toHaveLength(2);
  });

  test("missing GitHub authentication waits with exact remediation", async () => {
    const base = repository();
    const manifest = approve(base, [milestone([], [])]);
    const result = await project.validateProject(base, manifest.id, {
      publish: async () => {
        throw new project.PublicationError("AUTH", "not logged in");
      },
    });
    expect(result.result).toBe("waiting");
    expect(result.manifest.waiting?.remediation).toBe("gh auth login");
    expect(result.manifest.status).toBe("waiting");
  });

  test("baseline fingerprints distinguish unchanged failures from regressions", () => {
    expect(project.compareValidationFingerprint("same", "same")).toBe("unchanged");
    expect(project.compareValidationFingerprint("old", "new")).toBe("regression");
    expect(project.compareValidationFingerprint(undefined, "new")).toBe("new_failure");
  });
});

describe("OpenCode integration", () => {
  test("uses one project primary, native research, seven tools, and no GitHub MCP", () => {
    const root = join(import.meta.dir, "..");
    const config = JSON.parse(readFileSync(join(root, "config.jsonc"), "utf8"));
    const primary = readFileSync(join(root, "agents/primary/project.md"), "utf8");
    const tools = readFileSync(join(root, "tools/project.ts"), "utf8");

    expect(primary).toContain("model: openai/gpt-5.6-terra");
    expect(primary).toContain("explore: allow");
    expect(primary).toContain("scout: allow");
    expect(primary).toContain("implement-s: allow");
    expect(primary).toContain("implement-m: allow");
    expect(primary).toContain("implement-l: allow");
    expect(primary).toContain("the name is only a label");
    expect(primary).toContain(
      "or research the repository from the title alone",
    );
    expect(primary).toContain(
      "Store the first complete draft plan before presenting it",
    );
    expect(primary).toContain(
      "The assigned clean worktree HEAD is authoritative",
    );
    expect(config.permission.doom_loop).toBe("allow");
    expect(config.agent.explore.disable).toBe(false);
    expect(config.agent.scout.disable).toBe(false);
    expect(config.agent.build.disable).toBe(true);
    expect(config.agent.plan.disable).toBe(true);
    expect(config.agent.general.disable).toBe(true);
    expect(config.mcp?.github).toBeUndefined();

    for (const name of [
      "open",
      "plan",
      "status",
      "next",
      "context",
      "report",
      "validate",
    ]) expect(tools).toContain(`export const ${name}`);
    expect(tools).not.toMatch(/poll_token|repair_gate|complete_task|resolve_preflight/);
    expect(existsSync(join(root, "agents/subagents/diagnose.md"))).toBe(false);
    expect(existsSync(join(root, "agents/subagents/investigate.md"))).toBe(false);
    expect(existsSync(join(root, "lib/evidence-runner.ts"))).toBe(false);
  });

  test("implementers cannot delegate, publish, or mutate project state", async () => {
    const root = join(import.meta.dir, "..");
    for (const name of ["implement-s", "implement-m", "implement-l"]) {
      const source = readFileSync(join(root, `agents/subagents/${name}.md`), "utf8");
      expect(source).toContain("task: deny");
      expect(source).toContain("project_*: deny");
      expect(source).toContain('"git push*": deny');
      expect(source).toContain('"gh pr*": deny');
      expect(source).toContain("project_context: allow");
    }
    const base = repository();
    await expect(projectTools.open.execute(
      { action: "create", name_or_id: "unauthorized" },
      { agent: "implement-l", directory: base } as never,
    )).rejects.toThrow("Only the project primary agent");
  });
});
