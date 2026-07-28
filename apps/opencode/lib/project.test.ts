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
const worktrees = new Set<string>();

afterEach(() => {
  for (const worktree of worktrees) {
    rmSync(worktree, { recursive: true, force: true });
  }
  worktrees.clear();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(base: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: base, encoding: "utf8" }).trim();
}

function repository(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "project-v4-"));
  roots.push(root);
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
  git(root, "commit", "-m", "test fixture");
  return root;
}

function evidence(
  id: string,
  level: project.EvidenceLevel,
  command = ["node", "-e", "process.exit(0)"],
): project.EvidenceRequirement {
  return { id, level, command, proves: `${id} passes` };
}

function task(
  id = "change",
  tier: project.ImplementationTier = "m",
  allowedPaths = ["src/change.ts"],
): project.ProjectTaskInput {
  return {
    id,
    title: `Implement ${id}`,
    kind: "normal",
    implementation_tier: tier,
    tier_rationale: tier === "s"
      ? "Exact local pattern with no design decisions"
      : tier === "m"
      ? "Ordinary bounded component change in known architecture"
      : "Cross-boundary contract work requiring architectural reasoning",
    depends_on: [],
    allowed_paths: allowedPaths,
    acceptance_criteria: [`${id} behaves as approved`],
    required_evidence: [evidence("focused", "task")],
  };
}

function milestone(
  tasks: project.ProjectTaskInput[] = [task()],
  gates: project.EvidenceRequirement[] = [evidence("integration", "milestone")],
): project.ProjectMilestoneInput {
  return {
    id: "delivery",
    title: "Delivery",
    depends_on: [],
    acceptance_criteria: ["The integrated outcome is proven"],
    required_evidence: gates,
    tasks,
  };
}

function start(
  base: string,
  options: {
    preflight?: project.EvidenceRequirement[];
    milestones?: project.ProjectMilestoneInput[];
    name?: string;
  } = {},
): project.ProjectManifest {
  const created = project.createProject(base, options.name ?? "sustainable workflow");
  project.setProjectPlan(
    base,
    created.id,
    options.preflight ?? [],
    options.milestones ?? [milestone()],
  );
  return project.readProjectManifest(base, created.id);
}

function track(handle: project.TaskHandle): project.TaskHandle {
  worktrees.add(handle.worktree);
  return handle;
}

function commitFile(
  base: string,
  path: string,
  content = "export const value = true;\n",
): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
  git(base, "add", path);
  git(base, "-c", "commit.gpgsign=false", "commit", "-m", `feat: ${path}`);
}

describe("schema v4 and routing", () => {
  test("creates ignored schema-v4 state and rejects every earlier schema", () => {
    const base = repository();
    const created = project.createProject(base, "fresh system");
    expect(created.schema_version).toBe(4);
    expect(created.status).toBe("design");
    expect(created.integration_branch).toBe(`project/${created.id}`);
    expect(readFileSync(join(base, ".projects", ".gitignore"), "utf8"))
      .toBe("**\n!.gitignore\n");
    expect(git(base, "check-ignore", `.projects/${created.id}/project.json`))
      .toBe(`.projects/${created.id}/project.json`);

    for (const version of [1, 2, 3]) {
      const id = `000${version}-legacy`;
      mkdirSync(join(base, ".projects", id), { recursive: true });
      writeFileSync(
        join(base, ".projects", id, "project.json"),
        `${JSON.stringify({ schema_version: version })}\n`,
      );
      expect(() => project.readProjectManifest(base, id))
        .toThrow(`unsupported schema ${version}`);
    }
    expect(project.listProjects(base).map((item) => item.id)).toEqual([created.id]);
  });

  test("validates tiers and escalates upward without replacing a clean worktree", () => {
    const base = repository();
    const created = start(base, {
      milestones: [milestone([task("small-change", "s")])],
    });
    const handle = track(project.dispatchProjectTask(base, created.id, "small-change"));
    const escalated = project.escalateProjectTask(
      base,
      created.id,
      "small-change",
      "m",
      "The local pattern hides a bounded multi-component consistency risk",
    );
    expect(escalated.worktree).toBe(handle.worktree);
    expect(escalated.implementation_agent).toBe("implement-m");
    expect(() =>
      project.escalateProjectTask(base, created.id, "small-change", "s", "downgrade")
    ).toThrow("only escalate upward");
  });

  test("preserves partial edits during escalation and restricts context to the selected agent", () => {
    const base = repository();
    const created = start(base, {
      milestones: [milestone([task("partial", "s")])],
    });
    const handle = track(project.dispatchProjectTask(base, created.id, "partial"));
    mkdirSync(join(handle.worktree, "src"), { recursive: true });
    writeFileSync(join(handle.worktree, "src/change.ts"), "partial\n");

    const escalated = project.escalateProjectTask(
      base,
      created.id,
      "partial",
      "l",
      "A newly discovered public contract spans persistence and concurrency boundaries",
    );
    expect(escalated.worktree).toBe(handle.worktree);
    expect(readFileSync(join(handle.worktree, "src/change.ts"), "utf8")).toBe("partial\n");
    expect(() =>
      project.readProjectTaskContext(base, created.id, "partial", "implement-s")
    ).toThrow("assigned to implement-l");
    const context = project.readProjectTaskContext(
      base,
      created.id,
      "partial",
      "implement-l",
    );
    expect(context.contract.tier_rationale).toContain("public contract");
    expect(context.instructions.join(" ")).toContain("AGENTS.md");
  });

  test("rejects invalid task tiers in an approved plan", () => {
    const base = repository();
    const created = project.createProject(base, "invalid tier");
    const invalid = task() as project.ProjectTaskInput & { implementation_tier: string };
    invalid.implementation_tier = "xl";
    expect(() =>
      project.setProjectPlan(base, created.id, [], [milestone([invalid as project.ProjectTaskInput])])
    ).toThrow("incomplete or invalid");
  });
});

describe("single-call task completion", () => {
  test("runs every task check once, enforces scope, and merges cohesively", () => {
    const base = repository();
    const contract = task();
    contract.required_evidence = [
      evidence("first", "task"),
      evidence("second", "task"),
    ];
    const created = start(base, { milestones: [milestone([contract])] });
    const handle = track(project.dispatchProjectTask(base, created.id, "change"));
    commitFile(handle.worktree, "src/change.ts");

    const completed = project.completeProjectTask(base, created.id, "change");
    expect(completed.result).toBe("merged");
    expect(completed.evidence.map((item) => item.requirement_id))
      .toEqual(["first", "second"]);
    expect(project.readProjectManifest(base, created.id).evidence).toHaveLength(2);
    expect(git(base, "log", "-1", "--pretty=%s")).toBe("chore(project): integrate change");
  });

  test("rejects out-of-scope and dirty task worktrees before evidence", () => {
    const base = repository();
    const created = start(base);
    const handle = track(project.dispatchProjectTask(base, created.id, "change"));
    commitFile(handle.worktree, "outside.ts");
    expect(() => project.completeProjectTask(base, created.id, "change"))
      .toThrow("outside its contract");
    expect(project.readProjectManifest(base, created.id).evidence).toHaveLength(0);

    const dirtyBase = repository();
    const dirtyCreated = start(dirtyBase);
    const dirty = track(project.dispatchProjectTask(dirtyBase, dirtyCreated.id, "change"));
    mkdirSync(join(dirty.worktree, "src"), { recursive: true });
    writeFileSync(join(dirty.worktree, "src/change.ts"), "uncommitted\n");
    expect(() => project.completeProjectTask(dirtyBase, dirtyCreated.id, "change"))
      .toThrow("clean and committed");
  });

  test("persists complete logs, diagnostic tails, and stable failure fingerprints", () => {
    const base = repository();
    const contract = task();
    contract.required_evidence = [
      evidence(
        "failing",
        "task",
        ["node", "-e", "process.stderr.write('stable failure\\n');process.exit(7)"],
      ),
    ];
    const created = start(base, { milestones: [milestone([contract])] });
    const handle = track(project.dispatchProjectTask(base, created.id, "change"));
    commitFile(handle.worktree, "src/change.ts");

    const first = project.completeProjectTask(base, created.id, "change");
    const second = project.completeProjectTask(base, created.id, "change");
    expect(first.result).toBe("evidence-failed");
    expect(second.result).toBe("evidence-failed");
    expect(first.evidence[0]?.failure_fingerprint)
      .toBe(second.evidence[0]?.failure_fingerprint);
    expect(project.readProjectManifest(base, created.id).evidence).toHaveLength(1);
    expect(first.evidence[0]?.diagnostic_tail).toContain("stable failure");
    const log = join(base, first.evidence[0]!.log_path);
    expect(existsSync(log)).toBe(true);
    expect(readFileSync(log, "utf8")).toContain("stderr:\nstable failure");
  });
});

describe("preflight", () => {
  test("runs preflight sequentially before activating product tasks", () => {
    const base = repository();
    const created = start(base, {
      preflight: [
        evidence("baseline-one", "preflight"),
        evidence("baseline-two", "preflight"),
      ],
    });
    expect(project.readProjectStatus(base, created.id).ready_tasks).toHaveLength(0);
    const first = project.verifyProjectNext(base, created.id);
    expect(first.evidence?.requirement_id).toBe("baseline-one");
    expect(project.readProjectStatus(base, created.id).ready_tasks).toHaveLength(0);
    const second = project.verifyProjectNext(base, created.id);
    expect(second.evidence?.requirement_id).toBe("baseline-two");
    expect(second.manifest.preflight.status).toBe("passed");
    expect(second.manifest.ready_tasks.map((item) => item.id)).toEqual(["change"]);
  });

  test("pauses on baseline failure and records an explicit approved exception", () => {
    const base = repository();
    const created = start(base, {
      preflight: [
        evidence("baseline", "preflight", ["node", "-e", "process.exit(9)"]),
      ],
    });
    const failed = project.verifyProjectNext(base, created.id);
    expect(failed.result).toBe("fail");
    expect(failed.manifest.status).toBe("blocked");
    expect(failed.manifest.next_action).toContain("approved exception");

    const resolved = project.resolveProjectPreflight(
      base,
      created.id,
      "exception",
      "The user accepts this known baseline failure for this project only",
    );
    expect(resolved.preflight.status).toBe("excepted");
    expect(resolved.ready_tasks.map((item) => item.id)).toEqual(["change"]);
    expect(project.readProjectManifest(base, created.id).decisions[0]?.summary)
      .toContain("Approved preflight exception");
  });

  test("repairs a failing baseline and reruns it at the new integration revision", () => {
    const base = repository();
    const baseline = evidence(
      "baseline",
      "preflight",
      ["node", "-e", "process.exit(require('fs').existsSync('baseline.flag')?0:4)"],
    );
    const created = start(base, { preflight: [baseline] });
    project.verifyProjectNext(base, created.id);
    const repair = task("repair-baseline", "m", ["baseline.flag"]);
    repair.kind = "gate-repair";
    project.resolveProjectPreflight(
      base,
      created.id,
      "repair",
      "The baseline itself must be restored before product work",
      repair,
    );
    const handle = track(project.dispatchProjectTask(base, created.id, "repair-baseline"));
    commitFile(handle.worktree, "baseline.flag", "fixed\n");
    const completed = project.completeProjectTask(base, created.id, "repair-baseline");
    expect(completed.result).toBe("merged");
    const verified = project.verifyProjectNext(base, created.id);
    expect(verified.result).toBe("pass");
    expect(verified.manifest.preflight.status).toBe("passed");
    expect(verified.manifest.ready_tasks.map((item) => item.id)).toEqual(["change"]);
  });
});

describe("sequential milestone gates and cohesive repair", () => {
  test("stops at failure, reuses one repair worktree, and proves all gates at one revision", () => {
    const base = repository();
    const gates = [
      evidence("warmup", "milestone"),
      evidence(
        "behavior",
        "milestone",
        ["node", "-e", "process.exit(require('fs').existsSync('gate.flag')?0:7)"],
      ),
      evidence("remaining", "milestone"),
    ];
    const created = start(base, { milestones: [milestone([], gates)] });
    expect(project.verifyProjectNext(base, created.id).evidence?.requirement_id).toBe("warmup");
    const failed = project.verifyProjectNext(base, created.id);
    expect(failed.evidence?.requirement_id).toBe("behavior");
    expect(failed.manifest.milestones[0]?.status).toBe("repairing");
    expect(project.readProjectManifest(base, created.id).evidence).toHaveLength(2);

    const repair = task("repair-gate", "m", ["gate.flag", "note.txt"]);
    repair.kind = "gate-repair";
    project.createGateRepair(
      base,
      created.id,
      "delivery",
      repair,
      "The behavior gate proves the required marker is absent at integration",
    );
    const handle = track(project.dispatchProjectTask(base, created.id, "repair-gate"));
    const updatedRepair = { ...repair, tier_rationale: "Same root cause, clarified contract" };
    project.createGateRepair(
      base,
      created.id,
      "delivery",
      updatedRepair,
      "Further inspection confirms the same missing-marker root cause",
    );
    const reused = project.readProjectTaskContext(
      base,
      created.id,
      "repair-gate",
      "implement-m",
    );
    expect(reused.handle.worktree).toBe(handle.worktree);

    commitFile(handle.worktree, "note.txt", "diagnostic attempt\n");
    const diagnosticFailure = project.completeProjectTask(base, created.id, "repair-gate");
    expect(diagnosticFailure.result).toBe("evidence-failed");
    const initialFingerprint = failed.evidence!.failure_fingerprint;
    expect(diagnosticFailure.evidence.at(-1)?.failure_fingerprint).toBe(initialFingerprint);

    commitFile(handle.worktree, "gate.flag", "fixed\n");
    const merged = project.completeProjectTask(base, created.id, "repair-gate");
    expect(merged.result).toBe("merged");

    const priority = project.verifyProjectNext(base, created.id);
    expect(priority.evidence?.requirement_id).toBe("behavior");
    const staleWarmup = project.verifyProjectNext(base, created.id);
    expect(staleWarmup.evidence?.requirement_id).toBe("warmup");
    const remaining = project.verifyProjectNext(base, created.id);
    expect(remaining.evidence?.requirement_id).toBe("remaining");
    expect(remaining.manifest.status).toBe("done");

    const manifest = project.readProjectManifest(base, created.id);
    const verifiedRevision = manifest.milestones[0]!.verified_revision;
    for (const gate of gates) {
      const latest = manifest.evidence.filter((attempt) =>
        attempt.owner_type === "milestone" &&
        attempt.owner_id === "delivery" &&
        attempt.requirement_id === gate.id
      ).at(-1);
      expect(latest?.result).toBe("pass");
      expect(latest?.revision).toBe(verifiedRevision);
    }
  });
});

describe("generic contracts and configuration", () => {
  test("allows owner-scoped evidence IDs and executes arbitrary repository-declared commands", () => {
    const base = repository({
      "AGENTS.md": [
        "# Repository instructions",
        "",
        "Use this exact command for all verification:",
        "`node scripts/repository-check.mjs`",
        "",
      ].join("\n"),
      "scripts/repository-check.mjs": "process.exit(0);\n",
    });
    const exact = ["node", "scripts/repository-check.mjs"];
    const contract = task();
    contract.required_evidence = [evidence("verify", "task", exact)];
    const created = start(base, {
      preflight: [evidence("verify", "preflight", exact)],
      milestones: [
        milestone([contract], [evidence("verify", "milestone", exact)]),
      ],
    });
    expect(project.verifyProjectNext(base, created.id).result).toBe("pass");
    const handle = track(project.dispatchProjectTask(base, created.id, "change"));
    commitFile(handle.worktree, "src/change.ts");
    expect(project.completeProjectTask(base, created.id, "change").result).toBe("merged");
    expect(project.verifyProjectNext(base, created.id).result).toBe("pass");
    const owners = project.readProjectManifest(base, created.id).evidence
      .filter((attempt) => attempt.requirement_id === "verify")
      .map((attempt) => `${attempt.owner_type}:${attempt.owner_id}`);
    expect(owners).toContain("preflight:preflight");
    expect(owners).toContain("task:change");
    expect(owners).toContain("milestone:delivery");
  });

  test("uses native task permissions, exact model tiers, and no LLM budgets", () => {
    const root = join(import.meta.dir, "..");
    const config = JSON.parse(readFileSync(join(root, "config.jsonc"), "utf8"));
    const agents = {
      default: readFileSync(join(root, "agents/primary/default.md"), "utf8"),
      orchestrate: readFileSync(join(root, "agents/primary/orchestrate.md"), "utf8"),
      investigate: readFileSync(join(root, "agents/subagents/investigate.md"), "utf8"),
      diagnose: readFileSync(join(root, "agents/subagents/diagnose.md"), "utf8"),
      small: readFileSync(join(root, "agents/subagents/implement-s.md"), "utf8"),
      medium: readFileSync(join(root, "agents/subagents/implement-m.md"), "utf8"),
      large: readFileSync(join(root, "agents/subagents/implement-l.md"), "utf8"),
    };
    expect(agents.default).toContain("model: openai/gpt-5.6-terra");
    expect(agents.small).toContain("model: openai/gpt-5.6-luna");
    expect(agents.medium).toContain("model: openai/gpt-5.6-terra");
    expect(agents.large).toContain("model: openai/gpt-5.6-sol");
    expect(agents.orchestrate).toContain("implement-s: allow");
    expect(agents.orchestrate).toContain("implement-m: allow");
    expect(agents.orchestrate).toContain("implement-l: allow");
    expect(config.model).toBe("openai/gpt-5.6-terra");
    expect(config.small_model).toBe("openai/gpt-5.6-luna");
    expect(config.autoupdate).toBe(false);
    expect(config.compaction.prune).toBe(true);
    expect(config.permission.doom_loop).toBe("ask");
    expect(config.agent.scout.disable).toBe(true);
    expect(config.mcp.github.enabled).toBe(false);
    expect(JSON.stringify(config.permission.external_directory))
      .not.toMatch(/Development\/(?:personal|arai)/);
    for (const [name, source] of Object.entries(agents)) {
      expect(source, name).not.toMatch(/^(?:steps|variant|reasoningEffort):/m);
      if (["small", "medium", "large"].includes(name)) {
        expect(source).toContain("task: deny");
        expect(source).toContain("project_task_context: allow");
      }
    }
  });

  test("throws tool errors and contains no repository-specific workflow vocabulary", async () => {
    const root = join(import.meta.dir, "..");
    const toolSource = readFileSync(join(root, "tools/project.ts"), "utf8");
    expect(toolSource).not.toContain('return `Error:');
    expect(toolSource).not.toContain('return "Error:');
    expect(toolSource).toContain('throw new Error("Only orchestrate may mutate project state")');
    const base = repository();
    await expect(
      projectTools.create.execute(
        { name: "unauthorized" },
        { agent: "default", directory: base } as never,
      ),
    ).rejects.toThrow("Only orchestrate may mutate project state");

    const genericSources = [
      join(root, "README.md"),
      join(root, "lib/project.ts"),
      join(root, "tools/project.ts"),
      join(root, "agents/primary/orchestrate.md"),
      join(root, "agents/subagents/diagnose.md"),
      join(root, "agents/subagents/implement-s.md"),
      join(root, "agents/subagents/implement-m.md"),
      join(root, "agents/subagents/implement-l.md"),
    ].map((path) => readFileSync(path, "utf8").toLowerCase()).join("\n");
    for (const forbidden of [
      "gu" + "ita",
      "ay" + "ni",
      "pn" + "pm",
      "sve" + "lte",
      "car" + "go",
      "doc" + "ker",
      "make e" + "2e",
    ]) {
      expect(genericSources).not.toContain(forbidden);
    }
  });
});
