import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { ManagedAgentsPlugin } from "../plugins/managed-agents.ts"

const input = {
  client: {
    config: {
      get: async () => ({ data: { agent: { managed: { steps: 275 } } } }),
    },
  },
  worktree: process.cwd(),
  directory: process.cwd(),
  project: {},
  experimental_workspace: { register() {} },
  serverUrl: new URL("http://127.0.0.1"),
  $: {},
} as never

const parseSchema = (schema: unknown, value: unknown) =>
  (schema as { parse(input: unknown): unknown }).parse(value)

const safelyParseSchema = (schema: unknown, value: unknown) =>
  (schema as { safeParse(input: unknown): { success: boolean } }).safeParse(value)

describe("managed-agent plugin surface", () => {
  test("registers every Brain, Hands, and Session tool", async () => {
    const hooks = await ManagedAgentsPlugin(input)
    expect(Object.keys(hooks.tool ?? {}).sort()).toEqual(
      [
        "brain_collect",
        "brain_discard",
        "brain_integrate",
        "brain_spawn",
        "brain_status",
        "hand_edit",
        "hand_list",
        "hand_read",
        "hand_run",
        "hand_search",
        "hand_status",
        "hand_write",
        "session_events",
        "session_note",
      ].sort(),
    )
  })

  test("advertises bounded defaults on expensive hand tools", async () => {
    const hooks = await ManagedAgentsPlugin(input)
    const tools = hooks.tool ?? {}
    expect(parseSchema(tools.hand_run?.args.timeoutSeconds, undefined)).toBe(900)
    expect(parseSchema(tools.hand_search?.args.timeoutSeconds, undefined)).toBe(30)
    expect(parseSchema(tools.hand_list?.args.limit, undefined)).toBe(500)
    expect(safelyParseSchema(tools.session_events?.args.tail, 101).success).toBe(false)
  })

  test("adds the active execution budget to model context", async () => {
    const previous = process.env.OPENCODE_MANAGED_BUDGET
    process.env.OPENCODE_MANAGED_BUDGET = "long"
    try {
      const hooks = await ManagedAgentsPlugin(input)
      const output = { system: [] as string[] }
      await hooks["experimental.chat.system.transform"]?.({} as never, output)
      expect(output.system.join("\n")).toContain("long")
      expect(output.system.join("\n")).toContain("275 agent turns")
      expect(output.system.join("\n")).toContain("not a reason to ask")
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_MANAGED_BUDGET
      else process.env.OPENCODE_MANAGED_BUDGET = previous
    }
  })

  test("instructs new sessions to begin actionable work without reconfirmation", () => {
    const prompt = readFileSync(new URL("../agents/managed.md", import.meta.url), "utf8")
    expect(prompt).toContain("already the active user task")
    expect(prompt).toContain("begin immediately")
    expect(prompt).toContain("Do not ask whether to create a task")
  })
})
