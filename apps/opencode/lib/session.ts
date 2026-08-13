import type { PluginInput } from "@opencode-ai/plugin"
import { positionalSlice, sanitizeOutput } from "./managed.ts"

type OpenCodeClient = PluginInput["client"]

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

export async function assertSessionVisible(
  client: OpenCodeClient,
  currentSessionID: string,
  requestedSessionID: string,
  directory: string,
) {
  if (currentSessionID === requestedSessionID) return
  const [current, requested] = await Promise.all([
    client.session.get({ path: { id: currentSessionID }, query: { directory } }),
    client.session.get({ path: { id: requestedSessionID }, query: { directory } }),
  ])
  if (!current.data || !requested.data) throw new Error("session not found")
  const related =
    current.data.parentID === requested.data.id || requested.data.parentID === current.data.id
  if (!related) throw new Error("session_events is limited to the current session and direct relatives")
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
  return selected.map(({ info, parts }, offset): SessionEvent => ({
    index: base + offset,
    id: info.id,
    role: info.role,
    created: "time" in info ? info.time?.created : undefined,
    content: sanitizeOutput(
      parts.map((part) => textPart(part as unknown as Record<string, unknown>)).join("\n"),
      40_000,
    ),
  }))
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
