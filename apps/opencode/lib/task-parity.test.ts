import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as opencode from "./task";
import * as claude from "../../claude/mcp/task-server/lib/task";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "task-parity-"));
  roots.push(value);
  return value;
}

function git(base: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: base, stdio: "ignore" });
}

function repository(): string {
  const base = root();
  git(base, "init", "-b", "main");
  git(base, "config", "user.email", "ade@example.invalid");
  git(base, "config", "user.name", "ADE parity");
  writeFileSync(join(base, "README.md"), "fixture\n");
  git(base, "add", "README.md");
  git(base, "commit", "-m", "fixture");
  return base;
}

const contract = {
  status: "ready" as const,
  risk: "medium" as const,
  change_radius: ["component" as const],
  allowed_paths: ["src/**", "docs/tasks/**"],
  forbidden_paths: ["src/generated/**"],
  acceptance_criteria: ["component behavior is proven"],
  required_evidence: [{ id: "component", kind: "test", command: "ayni verify test --language rust --package demo", proves: "component behavior" }],
};

describe("task runtime parity", () => {
  test("new tasks use the same version-2 draft contract", () => {
    const open = opencode.createTask(root(), "demo task").manifest;
    const other = claude.createTask(root(), "demo task");
    expect(open.schema_version).toBe(2);
    expect(other.schema_version).toBe(2);
    expect(open.contract).toEqual(other.contract);
    expect(open.evidence).toEqual([]);
    expect(other.evidence).toEqual([]);
  });

  test("both runtimes enforce and record declared evidence", () => {
    const openRoot = root();
    const claudeRoot = root();
    const openId = opencode.createTask(openRoot, "evidence").manifest.id;
    const claudeId = claude.createTask(claudeRoot, "evidence").id;
    opencode.setTaskContract(openRoot, openId, contract);
    claude.setContract(claudeRoot, claudeId, contract);
    const evidence = { requirement_id: "component", command: contract.required_evidence[0].command, result: "pass" as const, note: "passed" };
    expect(opencode.recordTaskEvidence(openRoot, openId, evidence).evidence?.at(-1)?.result).toBe("pass");
    expect(claude.recordEvidence(claudeRoot, claudeId, evidence).evidence?.at(-1)?.result).toBe("pass");
  });

  test("both runtimes derive identical timing metrics from the phase log", () => {
    const now = Date.parse("2026-01-01T03:00:00Z");
    const manifest = {
      schema_version: 2 as const,
      id: "0001-timing",
      title: "Timing",
      status: "done" as const,
      current_phase: "audit" as const,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      docs: { design: "design.md", audit: "audit.md", decisions: "decisions.md" },
      phase_log: [
        { phase: "design" as const, at: "2026-01-01T00:00:00Z", note: "initial scope" },
        { phase: "design" as const, at: "2026-01-01T00:10:00Z", note: "task contract ready" },
        { phase: "implement" as const, at: "2026-01-01T00:30:00Z", note: "advance" },
        { phase: "audit" as const, at: "2026-01-01T01:00:00Z", note: "advance" },
        { phase: "implement" as const, at: "2026-01-01T01:15:00Z", note: "audit failed" },
        { phase: "audit" as const, at: "2026-01-01T01:45:00Z", note: "advance" },
        { phase: "audit" as const, at: "2026-01-01T02:00:00Z", note: "audit passed" },
      ],
      evidence: [
        { requirement_id: "component", command: "x", result: "fail" as const, note: "", recorded_at: "2026-01-01T01:10:00Z" },
        { requirement_id: "component", command: "x", result: "pass" as const, note: "", recorded_at: "2026-01-01T01:40:00Z" },
      ],
    };

    const open = opencode.computeTaskMetrics(manifest, now);
    const other = claude.computeTaskMetrics(manifest, now);
    expect(open).toEqual(other);
    expect(open.total_ms).toBe(2 * 60 * 60 * 1000);
    expect(open.repair_iterations).toBe(1);
    expect(open.evidence_runs).toBe(2);
    expect(open.evidence_pass).toBe(1);
    expect(open.evidence_fail).toBe(1);
    const byPhase = Object.fromEntries(open.phases.map((entry) => [entry.phase, entry]));
    expect(byPhase.design).toEqual({ phase: "design", visits: 1, active_ms: 30 * 60 * 1000 });
    expect(byPhase.implement).toEqual({ phase: "implement", visits: 2, active_ms: 60 * 60 * 1000 });
    expect(byPhase.audit).toEqual({ phase: "audit", visits: 2, active_ms: 30 * 60 * 1000 });
  });

  test("active tasks measure the open final phase up to now", () => {
    const openRoot = root();
    const id = opencode.createTask(openRoot, "live metrics").manifest.id;
    const report = opencode.readStatus(openRoot, id);
    expect(report.manifest.metrics?.phases.find((entry) => entry.phase === "design")?.visits).toBe(1);
    expect(report.manifest.metrics?.total_ms).toBeGreaterThanOrEqual(0);
  });

  test("legacy active tasks must be upgraded before implementation", () => {
    const base = root();
    const folder = join(base, "docs/tasks/0001-legacy");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "design.md"), "## State Transition\nnew\n\n## Removal Inventory\nold\n");
    writeFileSync(join(folder, "task.json"), JSON.stringify({
      id: "0001-legacy", title: "Legacy", status: "active", current_phase: "design",
      created_at: "2026-01-01", updated_at: "2026-01-01",
      docs: { design: "design.md", audit: "audit.md", decisions: "decisions.md" }, phase_log: [],
    }));
    expect(() => opencode.advancePhase(base, "0001-legacy", "implement", "go")).toThrow("upgraded");
  });

  test("both runtimes complete the sequential contract, evidence, scope, repair, and close lifecycle", () => {
    for (const runtime of ["opencode", "claude"] as const) {
      const base = repository();
      const manifest = runtime === "opencode"
        ? opencode.createTask(base, `${runtime} lifecycle`).manifest
        : claude.createTask(base, `${runtime} lifecycle`);
      const folder = join(base, "docs/tasks", manifest.id);
      writeFileSync(join(folder, "design.md"), "## State Transition\nnew\n\n## Removal Inventory\nold\n");
      writeFileSync(join(folder, "audit.md"), "# Audit\n");
      if (runtime === "opencode") opencode.setTaskContract(base, manifest.id, contract);
      else claude.setContract(base, manifest.id, contract);

      const branch = `feat/${manifest.id}`;
      git(base, "checkout", "-b", branch);
      if (runtime === "opencode") {
        opencode.setTaskBranch(base, manifest.id, { branch, checkedOut: true, note: "fixture branch" });
        opencode.advancePhase(base, manifest.id, "implement", "contract ready");
      } else {
        claude.setTaskBranch(base, manifest.id, branch, true, "fixture branch");
        claude.advance(base, manifest.id, "implement", "contract ready");
      }

      mkdirSync(join(base, "src"), { recursive: true });
      writeFileSync(join(base, "src/app.ts"), "export const ready = true;\n");
      const advanceToAudit = () => runtime === "opencode"
        ? opencode.advancePhase(base, manifest.id, "audit", "verify")
        : claude.advance(base, manifest.id, "audit", "verify");
      expect(advanceToAudit).toThrow("Required evidence has not passed");

      const evidence = {
        requirement_id: "component",
        command: contract.required_evidence[0].command,
        result: "pass" as const,
        artifact: ".ayni/verify/last/signals.json",
        note: "focused Ayni evidence passed",
      };
      if (runtime === "opencode") opencode.recordTaskEvidence(base, manifest.id, evidence);
      else claude.recordEvidence(base, manifest.id, evidence);

      mkdirSync(join(base, "src/generated"), { recursive: true });
      writeFileSync(join(base, "src/generated/out.ts"), "forbidden\n");
      expect(advanceToAudit).toThrow("Changed paths violate task contract");
      rmSync(join(base, "src/generated"), { recursive: true });

      expect(advanceToAudit().current_phase).toBe("audit");
      const failed = runtime === "opencode"
        ? opencode.closeTask(base, manifest.id, { verdict: "fail", note: "repair", foundationalBlockers: 0 })
        : claude.close(base, manifest.id, "fail", "repair", 0);
      expect(failed.current_phase).toBe("implement");
      expect(advanceToAudit().current_phase).toBe("audit");

      writeFileSync(join(folder, "decisions.md"), [
        "## State Transition", "new", "## Decisions", "sequential",
        "## Removed", "parallel agents", "## Blast Radius", "local",
        "## Verification Evidence", "focused Ayni passed", "## Remaining Work", "none", "",
      ].join("\n"));
      const closed = runtime === "opencode"
        ? opencode.closeTask(base, manifest.id, { verdict: "pass", note: "verified", foundationalBlockers: 0 })
        : claude.close(base, manifest.id, "pass", "verified", 0);
      expect(closed.status).toBe("done");
      expect(closed.phase_log.some((entry) => entry.note.includes("audit failed"))).toBe(true);
      expect(existsSync(join(folder, "task.json"))).toBe(true);
      expect(existsSync(join(folder, "decisions.md"))).toBe(true);
      expect(existsSync(join(folder, "design.md"))).toBe(false);
      expect(existsSync(join(folder, "audit.md"))).toBe(false);
      const durable = JSON.parse(readFileSync(join(folder, "task.json"), "utf8"));
      expect(durable.evidence.at(-1).artifact).toBe(".ayni/verify/last/signals.json");
    }
  });
});
