import type { PluginInput } from "@opencode-ai/plugin"
import { positionalSlice, sanitizeOutput } from "./managed.ts"

type OpenCodeClient = PluginInput["client"]

const MAX_EVENT_CONTENT = 40_000
const SESSION_CONTENT_BUDGET = 60_000

function textPart(part: Record<string, unknown>) {
  if (part.type === "text" && typeof part.text === "string") return part.text
  if (part.type === "tool") {
    const state = part.state && typeof part.state === "object" ? (part.state as Record<string, unknown>) : {}
    return JSON.stringify({ type: "tool", tool: part.tool, state: state.status })
  }
  return JSON.stringify({ type: part.type })
}

export type SessionEvent = {
  index: number
  id: string
  role: string
  created?: number
  content: string
}

export type RecentSessionEvent = Omit<SessionEvent, "index"> & { position: number }

function eventContent(
  { info, parts }: { info: Record<string, unknown>; parts: unknown[] },
  maximum = MAX_EVENT_CONTENT,
) {
  return {
    id: String(info.id),
    role: String(info.role),
    created:
      "time" in info ? (info.time as { created?: number } | undefined)?.created : undefined,
    content: sanitizeOutput(
      parts.map((part) => textPart(part as Record<string, unknown>)).join("\n"),
      maximum,
    ),
  }
}

function contentLimit(eventCount: number) {
  if (eventCount === 0) return MAX_EVENT_CONTENT
  return Math.min(MAX_EVENT_CONTENT, Math.floor(SESSION_CONTENT_BUDGET / eventCount))
}

export async function assertSessionVisible(
  client: OpenCodeClient,
  currentSessionID: string,
  requestedSessionID: string,
  directory: string,
) {
  if (currentSessionID === requestedSessionID) return
  const requested = await client.session.get({
    path: { id: requestedSessionID },
    query: { directory },
  })
  if (!requested.data) throw new Error("session not found")
  if (requested.data.parentID === currentSessionID) return
  const current = await client.session.get({
    path: { id: currentSessionID },
    query: { directory },
  })
  if (!current.data) throw new Error("session not found")
  if (current.data.parentID !== requested.data.id) {
    throw new Error("session_events is limited to the current session and direct relatives")
  }
}

export async function getSessionEvents(
  client: OpenCodeClient,
  currentSessionID: string,
  requestedSessionID: string,
  directory: string,
  start?: number,
  end?: number,
) {
  await assertSessionVisible(client, currentSessionID, requestedSessionID, directory)
  const response = await client.session.messages({
    path: { id: requestedSessionID },
    query: { directory },
  })
  if (!response.data) throw new Error(`unable to read session ${requestedSessionID}`)
  const selected = positionalSlice(response.data, start, end)
  const base = start === undefined ? 0 : start < 0 ? Math.max(response.data.length + start, 0) : start
  const maximum = contentLimit(selected.length)
  return selected.map(({ info, parts }, offset): SessionEvent => ({
    index: base + offset,
    ...eventContent(
      {
        info: info as unknown as Record<string, unknown>,
        parts: parts as unknown[],
      },
      maximum,
    ),
  }))
}

export async function getRecentSessionEvents(
  client: OpenCodeClient,
  currentSessionID: string,
  requestedSessionID: string,
  directory: string,
  tail = 20,
) {
  if (!Number.isInteger(tail) || tail < 1 || tail > 100) {
    throw new Error("tail must be an integer from 1 through 100")
  }
  await assertSessionVisible(client, currentSessionID, requestedSessionID, directory)
  const response = await client.session.messages({
    path: { id: requestedSessionID },
    query: { directory, limit: tail + 1 },
  })
  if (!response.data) throw new Error(`unable to read session ${requestedSessionID}`)
  const hasMore = response.data.length > tail
  const selected = response.data.slice(-tail)
  const maximum = contentLimit(selected.length)
  return {
    hasMore,
    events: selected.map(({ info, parts }, offset): RecentSessionEvent => ({
      position: offset - selected.length,
      ...eventContent(
        {
          info: info as unknown as Record<string, unknown>,
          parts: parts as unknown[],
        },
        maximum,
      ),
    })),
  }
}

export async function emitSessionNote(
  client: OpenCodeClient,
  sessionID: string,
  directory: string,
  text: string,
) {
  const result = await client.session.promptAsync({
    path: { id: sessionID },
    query: { directory },
    body: {
      noReply: true,
      parts: [{ type: "text", text: sanitizeOutput(text, 20_000) }],
    },
  })
  if (result.error) throw new Error(`unable to append session event: ${JSON.stringify(result.error)}`)
}
