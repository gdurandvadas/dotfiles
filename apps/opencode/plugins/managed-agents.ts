import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { ManagedBrains, workerPath } from "../lib/brain.ts"
import { LocalHands, type HandSpec } from "../lib/hands.ts"
import { sanitizeOutput, validHandID } from "../lib/managed.ts"
import { BunCommandRunner } from "../lib/process.ts"
import { getSessionEvents } from "../lib/session.ts"

export const ManagedAgentsPlugin: Plugin = async ({ client, worktree }) => {
  const runner = new BunCommandRunner()
  const hands = new LocalHands(runner)
  const brains = new ManagedBrains(client, runner, worktree)

  const handSpec = async (
    context: { sessionID: string; agent: string; worktree: string },
    hand: string,
  ): Promise<HandSpec> => {
    validHandID(hand)
    if (context.agent === "managed") {
      return {
        workspace: worktree,
        hand,
        mode: "primary",
      }
    }
    if (context.agent === "managed-reviewer") {
      return {
        workspace: worktree,
        hand,
        mode: "reviewer",
      }
    }
    if (context.agent === "managed-worker") {
      const workspace = workerPath(worktree, context.sessionID)
      if (!existsSync(workspace)) await brains.ensureWorker(context.sessionID)
      return {
        workspace,
        hand,
        mode: "worker",
      }
    }
    throw new Error(`agent ${context.agent} is not allowed to use managed hands`)
  }

  const primary = (agent: string) => {
    if (agent !== "managed") throw new Error(`${agent} cannot coordinate child brains`)
  }

  return {
    event: async ({ event }) => {
      if (event.type !== "session.deleted") return
      await brains.removeWorker(event.properties.info.id).catch(() => undefined)
    },
    tool: {
      session_events: tool({
        description:
          "Read a positional slice of the durable OpenCode event log. " +
          "Negative positions count from the end; at most 100 events are returned.",
        args: {
          session: tool.schema.string().optional(),
          start: tool.schema.number().int().optional(),
          end: tool.schema.number().int().optional(),
        },
        async execute(args, context) {
          const session = args.session ?? context.sessionID
          const events = await getSessionEvents(
            client,
            context.sessionID,
            session,
            worktree,
            args.start,
            args.end,
          )
          return JSON.stringify(events, null, 2)
        },
      }),
      session_note: tool({
        description:
          "Record a concise state or decision note. This tool call and its result are persisted " +
          "in the append-only session history.",
        args: {
          text: tool.schema.string().min(1).max(20_000),
          metadata: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
        },
        async execute(args) {
          return JSON.stringify({
            event: "session.note",
            text: sanitizeOutput(args.text, 20_000),
            metadata: args.metadata ?? {},
          })
        },
      }),
      hand_run: tool({
        description:
          "Run a shell command in the hand workspace using OpenCode's local environment. " +
          "Non-zero command exits are returned without automatic retry.",
        args: {
          command: tool.schema.string().min(1),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "run",
            command: args.command,
          })
        },
      }),
      hand_read: tool({
        description: "Read a text file inside the managed workspace without exposing host paths.",
        args: {
          path: tool.schema.string().min(1),
          offset: tool.schema.number().int().nonnegative().optional(),
          limit: tool.schema.number().int().positive().max(10_000).optional(),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "read",
            path: args.path,
            offset: args.offset,
            limit: args.limit,
          })
        },
      }),
      hand_write: tool({
        description: "Create or replace a file inside a writable managed hand.",
        args: {
          path: tool.schema.string().min(1),
          content: tool.schema.string(),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "write",
            path: args.path,
            content: args.content,
          })
        },
      }),
      hand_edit: tool({
        description:
          "Replace one exact text occurrence in a managed file, or every occurrence when replaceAll is true.",
        args: {
          path: tool.schema.string().min(1),
          oldText: tool.schema.string().min(1),
          newText: tool.schema.string(),
          replaceAll: tool.schema.boolean().default(false),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "edit",
            path: args.path,
            oldText: args.oldText,
            newText: args.newText,
            replaceAll: args.replaceAll,
          })
        },
      }),
      hand_search: tool({
        description: "Search managed workspace files with ripgrep.",
        args: {
          query: tool.schema.string().min(1),
          path: tool.schema.string().default("."),
          glob: tool.schema.string().optional(),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "search",
            query: args.query,
            path: args.path,
            glob: args.glob,
          })
        },
      }),
      hand_list: tool({
        description: "List managed workspace paths to a bounded depth.",
        args: {
          path: tool.schema.string().default("."),
          depth: tool.schema.number().int().positive().max(8).default(3),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(await handSpec(context, args.hand), {
            name: "list",
            path: args.path,
            depth: args.depth,
          })
        },
      }),
      hand_status: tool({
        description: "Report the local backend and logical hand mode.",
        args: { hand: tool.schema.string().default("default") },
        async execute(args, context) {
          return JSON.stringify(await hands.status(await handSpec(context, args.hand)), null, 2)
        },
      }),
      brain_spawn: tool({
        description:
          "Create and asynchronously dispatch a direct child brain. Workers receive isolated " +
          "Git worktrees; reviewers receive structured read-only tools.",
        args: {
          role: tool.schema.enum(["worker", "reviewer"]),
          task: tool.schema.string().min(1).max(20_000),
          title: tool.schema.string().max(160).optional(),
        },
        async execute(args, context) {
          primary(context.agent)
          const child = await brains.spawn(context.sessionID, args.role, args.task, args.title)
          return {
            title: `Spawned ${args.role}`,
            output: `${child.id}\n${child.title}`,
            metadata: { sessionID: child.id, role: args.role },
          }
        },
      }),
      brain_status: tool({
        description: "List direct child brains and their durable runner status.",
        args: { child: tool.schema.string().optional() },
        async execute(args, context) {
          primary(context.agent)
          return JSON.stringify(await brains.status(context.sessionID, args.child), null, 2)
        },
      }),
      brain_collect: tool({
        description: "Collect a bounded tail of durable events from a direct child brain.",
        args: {
          child: tool.schema.string().min(1),
          start: tool.schema.number().int().default(-12),
        },
        async execute(args, context) {
          primary(context.agent)
          return JSON.stringify(
            await brains.collect(context.sessionID, args.child, args.start),
            null,
            2,
          )
        },
      }),
      brain_integrate: tool({
        description:
          "Check and apply an idle worker's complete binary patch into the primary checkout as " +
          "unstaged changes, then remove its worktree.",
        args: { child: tool.schema.string().min(1) },
        async execute(args, context) {
          primary(context.agent)
          const result = await brains.integrate(context.sessionID, args.child, () =>
            context.ask({
              permission: "brain_integrate",
              patterns: [args.child],
              always: [],
              metadata: { child: args.child },
            }),
          )
          return JSON.stringify(result)
        },
      }),
      brain_discard: tool({
        description:
          "Discard one direct worker's unintegrated worktree while retaining its durable child session.",
        args: { child: tool.schema.string().min(1) },
        async execute(args, context) {
          primary(context.agent)
          await brains.discard(context.sessionID, args.child, () =>
            context.ask({
              permission: "brain_discard",
              patterns: [args.child],
              always: [],
              metadata: { child: args.child },
            }),
          )
          return `Discarded worker workspace for ${args.child}; session retained`
        },
      }),
    },
  }
}
