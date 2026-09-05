import { describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { getRecentSessionEvents, getSessionEvents } from "./session.ts"

type OpenCodeClient = PluginInput["client"]

function message(id: number, text = `event-${id}`) {
  return {
    info: { id: `message-${id}`, role: "assistant", time: { created: id } },
    parts: [{ type: "text", text }],
  }
}

function clientWith(messages: ReturnType<typeof message>[]) {
  const queries: Array<{ directory?: string; limit?: number }> = []
  const client = {
    session: {
      messages: async (input: { query: { directory?: string; limit?: number } }) => {
        queries.push(input.query)
        const selected = input.query.limit ? messages.slice(-input.query.limit) : messages
        return { data: selected }
      },
    },
  } as unknown as OpenCodeClient
  return { client, queries }
}

describe("session event retrieval", () => {
  test("fetches only an explicitly requested recent tail", async () => {
    const fixture = clientWith(Array.from({ length: 80 }, (_, index) => message(index)))
    const result = await getRecentSessionEvents(fixture.client, "current", "current", "/repo", 20)

    expect(fixture.queries).toEqual([{ directory: "/repo", limit: 21 }])
    expect(result.hasMore).toBe(true)
    expect(result.events).toHaveLength(20)
    expect(result.events[0]?.position).toBe(-20)
    expect(result.events.at(-1)?.position).toBe(-1)
  })

  test("reports when a short recent tail contains complete history", async () => {
    const fixture = clientWith(Array.from({ length: 3 }, (_, index) => message(index)))
    const result = await getRecentSessionEvents(fixture.client, "current", "current", "/repo", 5)

    expect(fixture.queries[0]?.limit).toBe(6)
    expect(result.hasMore).toBe(false)
    expect(result.events.map((event) => event.content)).toEqual(["event-0", "event-1", "event-2"])
  })

  test("retains absolute indices for positive and negative positional slices", async () => {
    const fixture = clientWith(Array.from({ length: 10 }, (_, index) => message(index)))
    const events = await getSessionEvents(fixture.client, "current", "current", "/repo", 2, 4)
    const tail = await getSessionEvents(fixture.client, "current", "current", "/repo", -2)

    expect(fixture.queries[0]?.limit).toBeUndefined()
    expect(events.map((event) => event.index)).toEqual([2, 3])
    expect(tail.map((event) => event.index)).toEqual([8, 9])
  })

  test("shares one bounded content budget across a recovered tail", async () => {
    const fixture = clientWith(
      Array.from({ length: 20 }, (_, index) => message(index, "x".repeat(10_000))),
    )
    const result = await getRecentSessionEvents(fixture.client, "current", "current", "/repo", 20)

    expect(result.events.reduce((total, event) => total + event.content.length, 0)).toBeLessThanOrEqual(
      60_000,
    )
    expect(result.events.every((event) => event.content.includes("omitted"))).toBe(true)
  })
})
