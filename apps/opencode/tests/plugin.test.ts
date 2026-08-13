import { describe, expect, test } from "bun:test"
import { ManagedAgentsPlugin } from "../plugins/managed-agents.ts"

describe("managed-agent plugin surface", () => {
  test("registers every Brain, Hands, and Session tool", async () => {
    const hooks = await ManagedAgentsPlugin({
      client: {},
      worktree: process.cwd(),
      directory: process.cwd(),
      project: {},
      experimental_workspace: { register() {} },
      serverUrl: new URL("http://127.0.0.1"),
      $: {},
    } as never)
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
})
