import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as project from "./project";

const roots: string[] = [];
const worktrees: string[] = [];
afterEach(() => {
  for (const worktree of worktrees.splice(0)) rmSync(worktree, { recursive: true, force: true });
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "project-runtime-")); roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-b", "main"); git("config", "user.email", "project@example.invalid"); git("config", "user.name", "Project test"); git("config", "commit.gpgsign", "false");
  writeFileSync(join(root, "README.md"), "fixture\n"); git("add", "README.md"); git("commit", "-m", "fixture"); return root;
}
const packageRequirement = { id: "unit", level: "package" as const, command: ["true"], proves: "package is green", covers: ["src/a.ts"] };
const finalRequirement = { id: "final", level: "final" as const, command: ["true"], proves: "integration is green", covers: ["src/**"] };
function nodes(): project.ProjectNode[] {
  return [{
    id: "financial-views", title: "Financial views", status: "ready", depends_on: [], allowed_paths: ["src/a.ts"], forbidden_paths: [],
    discovery_paths: ["src/*.test.ts"], acceptance_criteria: ["a exists"], required_evidence: [packageRequirement, finalRequirement],
  }];
}
function git(base: string, ...args: string[]): string { return execFileSync("git", args, { cwd: base, encoding: "utf8" }).trim(); }

describe("project runtime", () => {
  test("creates local ignored state and an untyped project branch", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul");
    expect(manifest.id).toBe("0001-income-overhaul"); expect(manifest.integration_branch).toBe("project/0001-income-overhaul");
    expect(existsSync(join(base, ".projects", manifest.id, "project.json"))).toBe(true);
    expect(readFileSync(join(base, ".projects", ".gitignore"), "utf8")).toBe("**\n!.gitignore\n");
    expect(git(base, "check-ignore", ".projects/0001-income-overhaul/project.json")).toBe(".projects/0001-income-overhaul/project.json");
    expect(() => git(base, "check-ignore", ".projects/.gitignore")).toThrow();
  });

  test("dispatches, verifies, merges, and closes a package", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul"); project.setProjectPlan(base, manifest.id, nodes());
    const dispatched = project.dispatchProjectNode(base, manifest.id, "financial-views"); const item = dispatched.nodes[0]!; worktrees.push(item.worktree!);
    mkdirSync(join(item.worktree!, "src"), { recursive: true }); writeFileSync(join(item.worktree!, "src", "a.ts"), "export const a = 1;\n");
    git(item.worktree!, "add", "src/a.ts"); git(item.worktree!, "commit", "-m", "feat(financial): add view state");
    project.verifyProjectRequirement(base, manifest.id, "unit", item.id); project.markProjectNodeVerified(base, manifest.id, item.id); project.mergeProjectNode(base, manifest.id, item.id);
    project.verifyProjectRequirement(base, manifest.id, "final"); const closed = project.closeProject(base, manifest.id, "all integrated");
    expect(closed.status).toBe("done"); expect(closed.nodes[0]?.status).toBe("merged");
    expect(JSON.parse(readFileSync(join(base, ".projects", manifest.id, "project.json"), "utf8")).metrics).toBeUndefined();
  });

  test("requeues clean broken packages and records unforeseen work", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul"); project.setProjectPlan(base, manifest.id, nodes());
    const dispatched = project.dispatchProjectNode(base, manifest.id, "financial-views"); worktrees.push(dispatched.nodes[0]!.worktree!); project.beginReconciliation(base, manifest.id, "financial-views", "package metadata failed");
    const requeued = project.requeueProjectNode(base, manifest.id, "financial-views", "restart from integration");
    expect(requeued.nodes[0]?.status).toBe("ready"); expect(requeued.status).toBe("active");
    const debt = { ...nodes()[0]!, id: "route-cleanup", title: "Route cleanup", required_evidence: [], depends_on: ["financial-views"] };
    const amended = project.amendProjectNode(base, manifest.id, debt, "unforeseen legacy route");
    expect(amended.nodes.map((item) => item.id)).toEqual(["financial-views", "route-cleanup"]);
    expect(amended.decisions.at(-1)?.summary).toBe("Added unforeseen work");
  });

  test("adopts validated work already integrated outside the package flow", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul"); project.setProjectPlan(base, manifest.id, nodes());
    const before = git(base, "rev-parse", "HEAD"); mkdirSync(join(base, "src"), { recursive: true }); writeFileSync(join(base, "src", "a.ts"), "export const a = 1;\n");
    git(base, "add", "src/a.ts"); git(base, "commit", "-m", "feat(financial): add adopted work"); const integrated = git(base, "rev-parse", "HEAD");
    project.beginReconciliation(base, manifest.id, "financial-views", "manual cherry-pick");
    const adopted = project.adoptIntegratedNode(base, manifest.id, "financial-views", before, integrated, "validated manual integration");
    expect(adopted.nodes[0]?.status).toBe("merged"); expect(adopted.decisions.at(-1)).toMatchObject({ summary: "Adopted integrated work", base_revision: before, integrated_revision: integrated });
  });

  test("rejects overlapping package writes", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul");
    project.setProjectPlan(base, manifest.id, [...nodes(), { ...nodes()[0]!, id: "other", title: "Other", required_evidence: [] }]);
    const dispatched = project.dispatchProjectNode(base, manifest.id, "financial-views"); worktrees.push(dispatched.nodes[0]!.worktree!); expect(() => project.dispatchProjectNode(base, manifest.id, "other")).toThrow("overlaps");
  });

  test("rejects dependency cycles and intersecting glob scopes", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul");
    const first = { ...nodes()[0]!, id: "first", depends_on: ["second"], allowed_paths: ["src/*/a.ts"] };
    const second = { ...nodes()[0]!, id: "second", depends_on: ["first"], allowed_paths: ["src/foo/*.ts"], required_evidence: [] };
    expect(() => project.setProjectPlan(base, manifest.id, [first, second])).toThrow("cycle");
    first.depends_on = []; second.depends_on = []; project.setProjectPlan(base, manifest.id, [first, second]);
    const dispatched = project.dispatchProjectNode(base, manifest.id, "first"); worktrees.push(dispatched.nodes[0]!.worktree!);
    expect(() => project.dispatchProjectNode(base, manifest.id, "second")).toThrow("overlaps");
  });

  test("refuses post-verification commits and unsafe evidence commands", () => {
    const base = repository(); const manifest = project.createProject(base, "income overhaul"); const plan = nodes();
    plan[0]!.required_evidence = [{ ...packageRequirement, command: ["/bin/rm", "-rf", "build"] }]; project.setProjectPlan(base, manifest.id, plan);
    const dispatched = project.dispatchProjectNode(base, manifest.id, "financial-views"); const item = dispatched.nodes[0]!; worktrees.push(item.worktree!);
    expect(() => project.verifyProjectRequirement(base, manifest.id, "unit", item.id)).toThrow("Unsafe evidence");

    const safeBase = repository(); const safeManifest = project.createProject(safeBase, "safe verification"); project.setProjectPlan(safeBase, safeManifest.id, nodes());
    const safeDispatched = project.dispatchProjectNode(safeBase, safeManifest.id, "financial-views"); const safeItem = safeDispatched.nodes[0]!; worktrees.push(safeItem.worktree!);
    mkdirSync(join(safeItem.worktree!, "src"), { recursive: true }); writeFileSync(join(safeItem.worktree!, "src", "a.ts"), "export const a = 1;\n");
    git(safeItem.worktree!, "add", "src/a.ts"); git(safeItem.worktree!, "commit", "-m", "feat: initial"); project.verifyProjectRequirement(safeBase, safeManifest.id, "unit", safeItem.id); project.markProjectNodeVerified(safeBase, safeManifest.id, safeItem.id);
    writeFileSync(join(safeItem.worktree!, "src", "a.ts"), "export const a = 2;\n"); git(safeItem.worktree!, "add", "src/a.ts"); git(safeItem.worktree!, "commit", "-m", "feat: changed later");
    expect(() => project.mergeProjectNode(safeBase, safeManifest.id, safeItem.id)).toThrow("changed after verification");
  });
});
