import { tool, type Plugin } from "@opencode-ai/plugin";
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
  orchestrate: ["design", "implement", "reconcile"],
  design: ["investigate"],
  implement: ["investigate", "code"],
  reconcile: ["design", "implement"],
};
function prefix(pattern: string): string { const index = pattern.search(/[?*]/); return pattern.slice(0, index < 0 ? pattern.length : index); }
function scopesOverlap(left: string[], right: string[]): boolean { return left.some((a) => right.some((b) => prefix(a).startsWith(prefix(b)) || prefix(b).startsWith(prefix(a)))); }

const ProjectTelemetryPlugin: Plugin = async ({ client }) => {
  const starts = new Map<string, number>();
  return {
    tool: {
      delegate: tool({
        description: "Run one or more allowed child agents in parallel and return their complete results.",
        args: {
          requests: tool.schema.array(tool.schema.object({
            agent: tool.schema.enum(["design", "implement", "reconcile", "investigate", "code"]),
            description: tool.schema.string(), prompt: tool.schema.string(), allowed_paths: tool.schema.array(tool.schema.string()).optional(),
          })),
        },
        async execute(args, context) {
          if (!args.requests.length || args.requests.length > 8) return "Error: delegate requires between 1 and 8 requests.";
          const allowed = delegation[context.agent] ?? [];
          const denied = args.requests.find((request) => !allowed.includes(request.agent));
          if (denied) return `Error: ${context.agent} cannot delegate to ${denied.agent}.`;
          if (context.agent === "reconcile" && args.requests.length > 1) return "Error: reconcile delegates design and implement sequentially, one request at a time.";
          const code = args.requests.filter((request) => request.agent === "code");
          if (code.some((request) => !request.allowed_paths?.length)) return "Error: code delegation requires explicit allowed_paths.";
          if (code.some((request, index) => code.slice(index + 1).some((other) => scopesOverlap(request.allowed_paths!, other.allowed_paths!)))) return "Error: parallel code delegation paths overlap.";
          const results = await Promise.all(args.requests.map(async (request) => {
            const created = await client.session.create({ body: { parentID: context.sessionID, title: request.description }, query: { directory: context.directory } });
            if (!created.data) return { agent: request.agent, error: "failed to create child session" };
            const childID = created.data.id;
            registerDelegation(childID, context.sessionID, request.agent);
            const response = await client.session.prompt({
              path: { id: childID }, query: { directory: context.directory },
              body: { agent: request.agent, parts: [{ type: "text", text: `${request.prompt}${request.allowed_paths?.length ? `\n\nAuthorized writable paths: ${request.allowed_paths.join(", ")}` : ""}` }] },
            });
            if (!response.data) return { agent: request.agent, session_id: childID, error: "child session returned no result" };
            const text = response.data.parts.filter((part) => part.type === "text").map((part) => "text" in part ? part.text : "").join("\n");
            return { agent: request.agent, session_id: childID, result: text };
          }));
          return JSON.stringify(results, null, 2);
        },
      }),
    },
    "tool.execute.before": async (input, output) => {
      const sid = sessionId(input, output); const trace = traceFor(sid); if (!trace) return;
      const tool = toolName(input, output); const call = callId(input, output) ?? tool; starts.set(`${sid}:${call}`, Date.now()); recordMetric(trace, { event: "tool.started", tool, outcome: "running" });
    },
    "tool.execute.after": async (input, output) => {
      const sid = sessionId(input, output); const trace = traceFor(sid); if (!trace) return;
      const tool = toolName(input, output); const call = callId(input, output) ?? tool; const key = `${sid}:${call}`; const duration = Date.now() - (starts.get(key) ?? Date.now()); starts.delete(key);
      const serialized = JSON.stringify(output); recordMetric(trace, { event: "tool.completed", tool, outcome: serialized.includes("Error:") ? "fail" : "pass", duration_ms: duration });
    },
    event: async ({ event }) => {
      const payload = object(event); const sid = sessionId(payload, payload.properties); const trace = traceFor(sid); if (!trace) return;
      if (["session.idle", "session.error"].includes(String(payload.type))) recordMetric(trace, { event: String(payload.type), outcome: payload.type === "session.error" ? "fail" : "pass" });
    },
  };
};

export default ProjectTelemetryPlugin;
