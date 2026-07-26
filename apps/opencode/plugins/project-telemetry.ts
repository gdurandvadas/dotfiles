import type { Plugin } from "@opencode-ai/plugin";
import { recordMetric, registerDelegation, traceFor } from "../lib/project-telemetry";

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function sessionId(...values: unknown[]): string | undefined {
  for (const value of values) for (const key of ["sessionID", "sessionId", "session_id"]) if (typeof object(value)[key] === "string") return object(value)[key] as string;
  return undefined;
}
function toolName(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof object(value).tool === "string") return object(value).tool as string;
  return undefined;
}
function callId(...values: unknown[]): string | undefined {
  for (const value of values) for (const key of ["callID", "callId", "call_id"]) if (typeof object(value)[key] === "string") return object(value)[key] as string;
  return undefined;
}
const delegation: Record<string, string[]> = {
  orchestrate: ["investigate", "implement"],
  implement: ["investigate", "code"],
};

function observedTool(name?: string): boolean {
  return Boolean(
    name &&
    (name.startsWith("project_") ||
      ["task", "bash", "edit", "apply_patch", "question"].includes(name)),
  );
}

const ProjectTelemetryPlugin: Plugin = async () => {
  const starts = new Map<string, number>();
  const pendingTasks = new Map<string, string[]>();
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "task") {
        const args = object(output.args);
        const agent = typeof args.subagent_type === "string" ? args.subagent_type : typeof args.agent === "string" ? args.agent : undefined;
        const trace = traceFor(input.sessionID);
        const allowed = trace ? delegation[trace.agent] ?? [] : [];
        if (agent && trace && !allowed.includes(agent)) throw new Error(`${trace.agent} cannot delegate to ${agent}.`);
        if (agent) pendingTasks.set(input.sessionID, [...(pendingTasks.get(input.sessionID) ?? []), agent]);
      }
      const sid = sessionId(input, output); const trace = traceFor(sid); if (!trace) return;
      const tool = toolName(input, output);
      if (!observedTool(tool)) return;
      const call = callId(input, output) ?? tool;
      starts.set(`${sid}:${call}`, Date.now());
      recordMetric(trace, { event: "tool.started", tool, outcome: "running" });
    },
    "tool.execute.after": async (input, output) => {
      const sid = sessionId(input, output); const trace = traceFor(sid); if (!trace) return;
      const tool = toolName(input, output);
      if (!observedTool(tool)) return;
      const call = callId(input, output) ?? tool;
      const key = `${sid}:${call}`;
      const duration = Date.now() - (starts.get(key) ?? Date.now());
      starts.delete(key);
      const serialized = JSON.stringify(output);
      const failed = serialized.includes("Error:") ||
        /"result"\s*:\s*"fail"/.test(serialized);
      recordMetric(trace, {
        event: "tool.completed",
        tool,
        outcome: failed ? "fail" : "pass",
        duration_ms: duration,
      });
    },
    event: async ({ event }) => {
      const payload = object(event); const properties = object(payload.properties); const sid = sessionId(payload, properties);
      if (payload.type === "session.created") {
        const info = object(properties.info); const parentID = typeof info.parentID === "string" ? info.parentID : undefined;
        const agent = parentID ? pendingTasks.get(parentID)?.shift() : undefined;
        if (parentID && agent && typeof info.id === "string") registerDelegation(info.id, parentID, agent);
      }
      const trace = traceFor(sid); if (!trace) return;
      if (["session.idle", "session.error"].includes(String(payload.type))) recordMetric(trace, { event: String(payload.type), outcome: payload.type === "session.error" ? "fail" : "pass" });
    },
  };
};

export default ProjectTelemetryPlugin;
