import { execFileSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as task from "./lib/task.js";

const baseDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const server = new McpServer({ name: "task", version: "1.0.0" });

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function toolResult(callback: () => unknown) {
  try {
    return result(callback());
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: baseDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function defaultBranch(): string {
  try {
    return git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").replace(/^origin\//, "");
  } catch {
    for (const candidate of ["main", "master"]) {
      try {
        git("rev-parse", "--verify", candidate);
        return candidate;
      } catch {
        continue;
      }
    }
  }
  throw new Error("Could not determine the default branch.");
}

function branchExists(branch: string): boolean {
  try {
    git("rev-parse", "--verify", branch);
    return true;
  } catch {
    return false;
  }
}

function setupBranch(id: string, changeType: string, newBranch: boolean) {
  if (!["feat", "fix", "doc", "chore", "refactor", "perf"].includes(changeType)) {
    throw new Error(`Invalid change type: ${changeType}`);
  }
  git("rev-parse", "--is-inside-work-tree");
  const branch = `${changeType}/${id}`;
  if (branchExists(branch)) {
    if (newBranch) throw new Error(`Branch ${branch} already exists. Choose Existing branch.`);
    git("switch", branch);
    return task.setTaskBranch(baseDir, id, branch, true, `Checked out ${branch}.`);
  }
  if (!newBranch) throw new Error(`Branch ${branch} does not exist.`);
  const base = defaultBranch();
  git("switch", base);
  git("switch", "-c", branch);
  return task.setTaskBranch(baseDir, id, branch, true, `Created ${branch} from ${base}.`);
}

server.registerTool(
  "create",
  { description: "Create a task manifest under docs/tasks.", inputSchema: { description: z.string() } },
  ({ description }) => toolResult(() => task.createTask(baseDir, description)),
);
server.registerTool(
  "status",
  { description: "Read task state and document presence.", inputSchema: { id: z.string() } },
  ({ id }) => toolResult(() => task.status(baseDir, task.resolveTask(baseDir, id))),
);
server.registerTool(
  "list",
  { description: "List all tasks with state.", inputSchema: {} },
  () => toolResult(() => task.list(baseDir)),
);
server.registerTool(
  "advance",
  {
    description: "Advance a task through its validated phase transition.",
    inputSchema: { id: z.string(), phase: z.enum(["design", "implement", "audit"]), note: z.string() },
  },
  ({ id, phase, note }) => toolResult(() => task.advance(baseDir, task.resolveTask(baseDir, id), phase, note)),
);
server.registerTool(
  "close",
  {
    description: "Close a passing audit or return a failing audit to implementation.",
    inputSchema: {
      id: z.string(),
      verdict: z.enum(["pass", "fail"]),
      note: z.string(),
      foundational_blockers: z.number().int().nonnegative(),
    },
  },
  ({ id, verdict, note, foundational_blockers }) =>
    toolResult(() => task.close(baseDir, task.resolveTask(baseDir, id), verdict, note, foundational_blockers)),
);
server.registerTool(
  "set_branch",
  {
    description: "Create or check out the task's conventional-commit branch.",
    inputSchema: {
      id: z.string(),
      change_type: z.enum(["feat", "fix", "doc", "chore", "refactor", "perf"]),
      new_branch: z.boolean(),
    },
  },
  ({ id, change_type, new_branch }) =>
    toolResult(() => setupBranch(task.resolveTask(baseDir, id), change_type, new_branch)),
);

await server.connect(new StdioServerTransport());
