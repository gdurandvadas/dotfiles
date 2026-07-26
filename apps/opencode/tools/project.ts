import { tool } from "@opencode-ai/plugin";
import {
  adoptIntegratedNode, amendProjectNode, beginReconciliation, closeProject, createProject,
  dispatchProjectNode, formatProjectReport, listProjects, markProjectNodeVerified, mergeProjectNode,
  readProjectStatus, recordProjectDecision, requeueProjectNode, resolveProject, setProjectPlan, verifyProjectRequirement,
  type ProjectNode,
} from "../lib/project";
import { startTrace } from "../lib/project-telemetry";

function output(callback: () => unknown): string {
  try { return JSON.stringify(callback(), null, 2); }
  catch (error) { return `Error: ${error instanceof Error ? error.message : String(error)}`; }
}
function mutation(context: { agent: string }, callback: () => unknown): string {
  if (context.agent !== "orchestrate") return "Error: Only orchestrate may mutate project state.";
  return output(callback);
}
const requirement = tool.schema.object({ id: tool.schema.string(), level: tool.schema.enum(["baseline", "package", "final"]), command: tool.schema.array(tool.schema.string()), proves: tool.schema.string(), covers: tool.schema.array(tool.schema.string()), timeout_ms: tool.schema.number().optional() });
const projectNode = tool.schema.object({
  id: tool.schema.string(), title: tool.schema.string(), status: tool.schema.enum(["ready", "running", "verified", "merged", "reconciling", "blocked"]).optional(),
  depends_on: tool.schema.array(tool.schema.string()), allowed_paths: tool.schema.array(tool.schema.string()), forbidden_paths: tool.schema.array(tool.schema.string()),
  discovery_paths: tool.schema.array(tool.schema.string()), acceptance_criteria: tool.schema.array(tool.schema.string()), required_evidence: tool.schema.array(requirement),
});

export const create = tool({ description: "Create a local project and project/<id> integration branch.", args: { name: tool.schema.string() }, async execute(args, context) { return mutation(context, () => createProject(context.directory, args.name)); } });
export const status = tool({ description: "Read authoritative project state and ready work.", args: { id: tool.schema.string() }, async execute(args, context) { return output(() => readProjectStatus(context.directory, resolveProject(context.directory, args.id))); } });
export const list = tool({ description: "List local projects.", args: {}, async execute(_args, context) { return output(() => listProjects(context.directory)); } });
export const plan = tool({ description: "Set the initial project task graph after design.", args: { id: tool.schema.string(), nodes: tool.schema.array(projectNode) }, async execute(args, context) { return mutation(context, () => setProjectPlan(context.directory, resolveProject(context.directory, args.id), args.nodes as ProjectNode[])); } });
export const dispatch = tool({ description: "Create a worktree for one dependency-ready node.", args: { id: tool.schema.string(), node_id: tool.schema.string() }, async execute(args, context) { return mutation(context, () => dispatchProjectNode(context.directory, resolveProject(context.directory, args.id), args.node_id)); } });
export const verify = tool({ description: "Run and record one exact evidence requirement.", args: { id: tool.schema.string(), requirement_id: tool.schema.string(), node_id: tool.schema.string().optional() }, async execute(args, context) { return mutation(context, () => verifyProjectRequirement(context.directory, resolveProject(context.directory, args.id), args.requirement_id, args.node_id)); } });
export const verify_package = tool({ description: "Validate package scope and fresh evidence.", args: { id: tool.schema.string(), node_id: tool.schema.string() }, async execute(args, context) { return mutation(context, () => markProjectNodeVerified(context.directory, resolveProject(context.directory, args.id), args.node_id)); } });
export const merge = tool({ description: "Merge one verified package into its project branch.", args: { id: tool.schema.string(), node_id: tool.schema.string() }, async execute(args, context) { return mutation(context, () => mergeProjectNode(context.directory, resolveProject(context.directory, args.id), args.node_id)); } });
export const reconcile = tool({ description: "Place an unmerged node into explicit reconciliation.", args: { id: tool.schema.string(), node_id: tool.schema.string(), rationale: tool.schema.string() }, async execute(args, context) { return mutation(context, () => beginReconciliation(context.directory, resolveProject(context.directory, args.id), args.node_id, args.rationale)); } });
export const decide = tool({ description: "Record a durable project or node decision.", args: { id: tool.schema.string(), summary: tool.schema.string(), rationale: tool.schema.string(), node_id: tool.schema.string().optional() }, async execute(args, context) { return mutation(context, () => recordProjectDecision(context.directory, resolveProject(context.directory, args.id), args.summary, args.rationale, args.node_id)); } });
export const requeue = tool({ description: "Safely return a broken unintegrated node to ready.", args: { id: tool.schema.string(), node_id: tool.schema.string(), rationale: tool.schema.string() }, async execute(args, context) { return mutation(context, () => requeueProjectNode(context.directory, resolveProject(context.directory, args.id), args.node_id, args.rationale)); } });
export const adopt = tool({ description: "Validate and adopt work already present on the integration branch.", args: { id: tool.schema.string(), node_id: tool.schema.string(), base_revision: tool.schema.string(), integrated_revision: tool.schema.string(), rationale: tool.schema.string() }, async execute(args, context) { return mutation(context, () => adoptIntegratedNode(context.directory, resolveProject(context.directory, args.id), args.node_id, args.base_revision, args.integrated_revision, args.rationale)); } });
export const amend = tool({ description: "Add unforeseen work or replace one unmerged node contract.", args: { id: tool.schema.string(), node: projectNode, rationale: tool.schema.string() }, async execute(args, context) { return mutation(context, () => amendProjectNode(context.directory, resolveProject(context.directory, args.id), args.node as ProjectNode, args.rationale)); } });
export const close = tool({ description: "Close a fully integrated project with fresh final evidence.", args: { id: tool.schema.string(), note: tool.schema.string() }, async execute(args, context) { return mutation(context, () => closeProject(context.directory, resolveProject(context.directory, args.id), args.note)); } });
export const report = tool({ description: "Return a compact project report.", args: { id: tool.schema.string() }, async execute(args, context) { try { return formatProjectReport(readProjectStatus(context.directory, resolveProject(context.directory, args.id))); } catch (error) { return `Error: ${error instanceof Error ? error.message : String(error)}`; } } });
export const trace = tool({
  description: "Bind this agent session to a project trace. This records metrics only and never changes project state.",
  args: { id: tool.schema.string(), node_id: tool.schema.string().optional() },
  async execute(args, context) { return output(() => startTrace({ project_id: resolveProject(context.directory, args.id), session_id: context.sessionID, agent: context.agent, directory: context.directory, node_id: args.node_id })); },
});
