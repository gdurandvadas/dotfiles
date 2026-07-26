import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type TraceOrigin = "orchestrate" | "design" | "implement" | "reconcile";
export type TraceStage = "orchestration" | "research" | "planning" | "implementation" | "verification" | "integration" | "reconciliation" | "audit";

export interface ProjectTrace {
  project_id: string;
  session_id: string;
  agent: string;
  origin: TraceOrigin;
  stage: TraceStage;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  node_id?: string;
  directory: string;
  revision?: string;
}

interface Delegation {
  parent_session_id: string;
  child_agent: string;
}

const claims = new Map<string, ProjectTrace>();
const delegations = new Map<string, Delegation>();
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const projectFolder = (directory: string, projectId: string) => join(directory, ".projects", projectId);

const stages: Record<string, TraceStage> = { orchestrate: "orchestration", design: "planning", implement: "implementation", reconcile: "reconciliation", investigate: "research", code: "implementation" };

export function registerDelegation(childSessionId: string, parentSessionId: string, childAgent: string): void {
  delegations.set(childSessionId, { parent_session_id: parentSessionId, child_agent: childAgent });
}

export function startTrace(input: Pick<ProjectTrace, "project_id" | "session_id" | "agent" | "directory" | "node_id">): ProjectTrace {
  if (!existsSync(join(projectFolder(input.directory, input.project_id), "project.json"))) throw new Error(`Project not found: ${input.project_id}`);
  if (claims.has(input.session_id)) throw new Error("A project session cannot be rebound to another trace span.");
  const delegation = delegations.get(input.session_id); const parent = delegation ? claims.get(delegation.parent_session_id) : undefined;
  if (input.agent !== "orchestrate" && (!delegation || !parent || delegation.child_agent !== input.agent || parent.project_id !== input.project_id)) throw new Error("Delegated traces require a registered parent session in the same project.");
  if (input.agent === "orchestrate" && delegation) throw new Error("Orchestrate must start a root project trace.");
  const project = JSON.parse(readFileSync(join(projectFolder(input.directory, input.project_id), "project.json"), "utf8")) as { nodes?: Array<{ id: string }> };
  const nodeID = parent?.node_id ?? input.node_id;
  if (parent?.node_id && input.node_id && parent.node_id !== input.node_id) throw new Error("Child trace node must match its parent node.");
  if (nodeID && !project.nodes?.some((node) => node.id === nodeID)) throw new Error(`Project node not found: ${nodeID}`);
  const origin: TraceOrigin = parent ? (parent.agent === "orchestrate" ? input.agent as TraceOrigin : parent.origin) : "orchestrate";
  const stage = stages[input.agent]; if (!stage) throw new Error(`Unsupported traced agent: ${input.agent}`);
  let revision: string | undefined;
  if (existsSync(join(input.directory, ".git"))) {
    try { revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: input.directory, encoding: "utf8" }).trim(); } catch { /* tracing also supports non-Git test fixtures */ }
  }
  const trace: ProjectTrace = {
    ...input, ...(nodeID ? { node_id: nodeID } : {}), origin, stage, ...(revision ? { revision } : {}),
    trace_id: parent?.trace_id ?? id("trc"), span_id: id("spn"), ...(parent ? { parent_span_id: parent.span_id } : {}),
  };
  claims.set(trace.session_id, trace);
  recordMetric(trace, { event: "agent.started", outcome: "running" });
  return trace;
}

export function traceFor(sessionId?: string): ProjectTrace | undefined { return sessionId ? claims.get(sessionId) : undefined; }

export function recordMetric(trace: ProjectTrace, event: Record<string, unknown>): void {
  const record = {
    ...event, schema_version: 1, timestamp: now(), project_id: trace.project_id, trace_id: trace.trace_id,
    span_id: trace.span_id, ...(trace.parent_span_id ? { parent_span_id: trace.parent_span_id } : {}),
    ...(trace.node_id ? { node_id: trace.node_id } : {}), agent: trace.agent, origin: trace.origin,
    stage: trace.stage, ...(trace.revision ? { revision: trace.revision } : {}),
  };
  appendFileSync(join(projectFolder(trace.directory, trace.project_id), "metrics.jsonl"), `${JSON.stringify(record)}\n`);
}
