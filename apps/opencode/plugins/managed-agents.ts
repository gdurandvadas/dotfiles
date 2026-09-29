import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { ManagedBrains, workerPath } from "../lib/brain.ts"
import { LocalHands, type HandSpec } from "../lib/hands.ts"
import { sanitizeOutput, validHandID } from "../lib/managed.ts"
import { BunCommandRunner } from "../lib/process.ts"
import { getRecentSessionEvents, getSessionEvents } from "../lib/session.ts"

export const ManagedAgentsPlugin: Plugin = async ({ client, worktree }) => {
  const runner = new BunCommandRunner()
  const hands = new LocalHands(runner)
  const brains = new ManagedBrains(client, runner, worktree)
  let managedStepBudget: Promise<number | undefined> | undefined

  const resolvedManagedStepBudget = () => {
    managedStepBudget ??= client.config
      .get({ query: { directory: worktree } })
      .then((response) => {
        const steps = response.data?.agent?.managed?.steps
        return typeof steps === "number" ? steps : undefined
      })
      .catch(() => undefined)
    return managedStepBudget
  }

  const handSpec = async (
    context: { sessionID: string; agent: string; worktree: string },
    hand?: string,
  ): Promise<HandSpec> => {
    const resolvedHand = hand ?? "default"
    validHandID(resolvedHand)
    if (context.agent === "managed") {
      return {
        workspace: worktree,
        hand: resolvedHand,
        mode: "primary",
      }
    }
    if (context.agent === "managed-reviewer") {
      return {
        workspace: worktree,
        hand: resolvedHand,
        mode: "reviewer",
      }
    }
    if (context.agent === "managed-plan") {
      return {
        workspace: worktree,
        hand: resolvedHand,
        mode: "reviewer",
      }
    }
    if (context.agent === "managed-worker") {
      const workspace = workerPath(worktree, context.sessionID)
      if (!existsSync(workspace)) await brains.ensureWorker(context.sessionID)
      return {
        workspace,
        hand: resolvedHand,
        mode: "worker",
      }
    }
    throw new Error(`agent ${context.agent} is not allowed to use managed hands`)
  }

  const primary = (agent: string) => {
    if (agent !== "managed") throw new Error(`${agent} cannot coordinate child brains`)
  }

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const profile = process.env.OPENCODE_MANAGED_BUDGET ?? "standard"
      const steps = await resolvedManagedStepBudget()
      const descriptions: Record<string, string> = {
        small: "small: favor a narrow direct solution and focused verification",
        standard: "standard: handle normal multi-step repository work",
        long: "long: sustain a broad implementation while keeping phases bounded",
      }
      output.system.push(
        `Managed execution budget: ${descriptions[profile] ?? descriptions.standard}. ` +
          (steps === undefined ? "" : `The resolved primary ceiling is ${steps} agent turns. `) +
          "This is an execution ceiling; it does not replace the task-contract decision in the " +
          "agent instructions.",
      )
    },
    event: async ({ event }) => {
      if (event.type !== "session.deleted") return
      await brains.removeWorker(event.properties.info.id).catch(() => undefined)
    },
    tool: {
      session_events: tool({
        description:
          "Read the durable OpenCode event log. Prefer tail for efficient recent recovery; " +
          "start/end retain exact absolute positional slicing. At most 100 events are returned.",
        args: {
          session: tool.schema.string().optional(),
          start: tool.schema.number().int().optional(),
          end: tool.schema.number().int().optional(),
          tail: tool.schema.number().int().min(1).max(100).optional(),
        },
        async execute(args, context) {
          const session = args.session ?? context.sessionID
          if (args.tail !== undefined) {
            if (args.start !== undefined || args.end !== undefined) {
              throw new Error("tail cannot be combined with start or end")
            }
            return JSON.stringify(
              await getRecentSessionEvents(
                client,
                context.sessionID,
                session,
                worktree,
                args.tail,
              ),
              null,
              2,
            )
          }
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
          "The default deadline is 15 minutes; use up to 60 minutes only when the repository " +
          "contract requires it. Non-zero exits are returned without automatic retry.",
        args: {
          command: tool.schema.string().min(1),
          hand: tool.schema.string().default("default"),
          timeoutSeconds: tool.schema.number().int().min(1).max(3600).default(900),
        },
        async execute(args, context) {
          context.metadata({ title: `Run (${args.timeoutSeconds}s deadline)` })
          return hands.execute(await handSpec(context, args.hand), {
            name: "run",
            command: args.command,
            timeoutSeconds: args.timeoutSeconds,
          }, context.abort)
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
          return hands.execute(
            await handSpec(context, args.hand),
            {
              name: "read",
              path: args.path,
              offset: args.offset,
              limit: args.limit,
            },
            context.abort,
          )
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
          return hands.execute(
            await handSpec(context, args.hand),
            { name: "write", path: args.path, content: args.content },
            context.abort,
          )
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
          return hands.execute(
            await handSpec(context, args.hand),
            {
              name: "edit",
              path: args.path,
              oldText: args.oldText,
              newText: args.newText,
              replaceAll: args.replaceAll,
            },
            context.abort,
          )
        },
      }),
      hand_search: tool({
        description: "Search managed workspace files with ripgrep.",
        args: {
          query: tool.schema.string().min(1),
          path: tool.schema.string().default("."),
          glob: tool.schema.string().optional(),
          includeGenerated: tool.schema.boolean().default(false),
          timeoutSeconds: tool.schema.number().int().min(1).max(120).default(30),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(
            await handSpec(context, args.hand),
            {
              name: "search",
              query: args.query,
              path: args.path,
              glob: args.glob,
              includeGenerated: args.includeGenerated,
              timeoutSeconds: args.timeoutSeconds,
            },
            context.abort,
          )
        },
      }),
      hand_list: tool({
        description: "List managed workspace paths to a bounded depth.",
        args: {
          path: tool.schema.string().default("."),
          depth: tool.schema.number().int().positive().max(8).default(3),
          limit: tool.schema.number().int().positive().max(2000).default(500),
          includeGenerated: tool.schema.boolean().default(false),
          hand: tool.schema.string().default("default"),
        },
        async execute(args, context) {
          return hands.execute(
            await handSpec(context, args.hand),
            {
              name: "list",
              path: args.path,
              depth: args.depth,
              limit: args.limit,
              includeGenerated: args.includeGenerated,
            },
            context.abort,
          )
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
          tail: tool.schema.number().int().min(1).max(100).default(12),
        },
        async execute(args, context) {
          primary(context.agent)
          return JSON.stringify(
            await brains.collect(context.sessionID, args.child, args.tail),
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
          const result = await brains.integrate(context.sessionID, args.child)
          return JSON.stringify(result)
        },
      }),
      brain_discard: tool({
        description:
          "Discard one direct worker's unintegrated worktree while retaining its durable child session.",
        args: { child: tool.schema.string().min(1) },
        async execute(args, context) {
          primary(context.agent)
          await brains.discard(context.sessionID, args.child)
          return `Discarded worker workspace for ${args.child}; session retained`
        },
      }),
    },
  }
}
