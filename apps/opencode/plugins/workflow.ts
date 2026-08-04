import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { relative } from "node:path"
import { guardProtectedPaths } from "../lib/protection.ts"
import {
  BUILD_AGENTS,
  createCheckpoint,
  createContract,
  readStates,
  selectState,
  stateSummary,
  workspaceRoot,
  writeContract,
} from "../lib/workflow.ts"

export const WorkflowPlugin: Plugin = async ({ client }) => ({
  "tool.execute.before": async (input, output) => {
    guardProtectedPaths(input.tool, output.args)
  },
  tool: {
    workflow_contract: tool({
      description:
        "Validate a milestone DAG with Kahn's algorithm and create its immutable Markdown " +
        "execution contract. Only the Plan agent may call this tool.",
      args: {
        slug: tool.schema
          .string()
          .describe("Stable lowercase milestone id, for example account-recovery"),
        title: tool.schema.string().describe("Short product-facing milestone title"),
        objective: tool.schema.string().describe("Observable outcome of the milestone"),
        acceptance: tool.schema.array(tool.schema.string()).describe("Product acceptance criteria"),
        nonGoals: tool.schema.array(tool.schema.string()).describe("Explicit non-goals"),
        tasks: tool.schema.array(
          tool.schema.object({
            id: tool.schema.string().describe("Stable uppercase task id, for example API-1"),
            title: tool.schema.string(),
            agent: tool.schema.enum(BUILD_AGENTS),
            dependencies: tool.schema.array(tool.schema.string()),
            scope: tool.schema.string(),
            acceptance: tool.schema.string(),
            validation: tool.schema.array(tool.schema.string()),
          }),
        ),
      },
      async execute(args, context) {
        if (context.agent !== "plan") {
          throw new Error(`workflow_contract is restricted to the Plan agent, not ${context.agent}`)
        }
        const root = workspaceRoot(context)
        const contract = createContract(args)
        const path = writeContract(root, contract)
        await client.tui
          .showToast({
            body: {
              title: "Execution contract sealed",
              message: `${contract.title} · ${contract.waves.length} waves`,
              variant: "success",
              duration: 5000,
            },
          })
          .catch(() => undefined)
        return {
          title: `Sealed ${contract.slug}`,
          output: [
            `Created ${relative(root, path)}`,
            `${contract.tasks.length} tasks across ${contract.waves.length} waves`,
            "The file is create-once. Start execution with /milestone-run.",
          ].join("\n"),
          metadata: { slug: contract.slug, waves: contract.waves.length },
        }
      },
    }),
    workflow_checkpoint: tool({
      description:
        "Accept the next completed wave and create its immutable product-facing ADR. Only pm-agent may call this tool.",
      args: {
        milestone: tool.schema.string(),
        wave: tool.schema.number().int().positive(),
        summary: tool.schema.string().describe("Concise engineering synthesis"),
        productImpact: tool.schema.string().describe("Observable product impact in plain language"),
        decisions: tool.schema.array(tool.schema.string()),
        validation: tool.schema.array(
          tool.schema.object({
            command: tool.schema.string(),
            result: tool.schema.enum(["passed", "skipped"]),
            evidence: tool.schema.string(),
          }),
        ),
        followUps: tool.schema.array(tool.schema.string()),
      },
      async execute(args, context) {
        if (context.agent !== "pm-agent") {
          throw new Error(`workflow_checkpoint is restricted to pm-agent, not ${context.agent}`)
        }
        const root = workspaceRoot(context)
        const result = createCheckpoint(root, args)
        const next = selectState(root, args.milestone)
        await client.tui
          .showToast({
            body: {
              title: `Wave ${args.wave} accepted`,
              message: next.completed ? "Milestone complete" : `Wave ${next.currentWave?.number} is ready`,
              variant: "success",
              duration: 6000,
            },
          })
          .catch(() => undefined)
        return {
          title: `Accepted ${args.milestone} · Wave ${args.wave}`,
          output: `${relative(root, result.path)}\n${stateSummary(next)}`,
          metadata: { milestone: args.milestone, wave: args.wave, completed: next.completed },
        }
      },
    }),
    workflow_status: tool({
      description:
        "Derive milestone progress and the next runnable wave from immutable plan and ADR files. " +
        "This tool never writes state.",
      args: {
        milestone: tool.schema.string().optional(),
        format: tool.schema.enum(["summary", "json"]).default("summary"),
      },
      async execute(args, context) {
        const root = workspaceRoot(context)
        if (args.format === "json") {
          const states = args.milestone ? [selectState(root, args.milestone)] : readStates(root)
          return JSON.stringify(states, null, 2)
        }
        return stateSummary(selectState(root, args.milestone))
      },
    }),
  },
})
