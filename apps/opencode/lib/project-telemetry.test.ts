import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordMetric, registerDelegation, startTrace, traceFor } from "./project-telemetry";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("writes append-only trace lineage beside project state", () => {
  const directory = mkdtempSync(join(tmpdir(), "project-trace-")); roots.push(directory);
  mkdirSync(join(directory, ".projects", "0001-demo"), { recursive: true }); writeFileSync(join(directory, ".projects", "0001-demo", "project.json"), "{}\n");
  const root = startTrace({ project_id: "0001-demo", session_id: "orchestrator", agent: "orchestrate", directory });
  registerDelegation("designer", "orchestrator", "design");
  const child = startTrace({ project_id: "0001-demo", session_id: "designer", agent: "design", directory });
  recordMetric(child, { event: "tool.completed", tool: "grep", outcome: "pass", duration_ms: 12 });
  const records = readFileSync(join(directory, ".projects", "0001-demo", "metrics.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  expect(records).toHaveLength(3); expect(records[1]).toMatchObject({ trace_id: root.trace_id, parent_span_id: root.span_id, agent: "design", origin: "design", stage: "planning" });
  expect(records[2]).toMatchObject({ event: "tool.completed", duration_ms: 12 }); expect(traceFor("designer")?.span_id).toBe(child.span_id);
  expect(() => startTrace({ project_id: "0001-demo", session_id: "spoof", agent: "code", directory })).toThrow("registered parent session");
});
