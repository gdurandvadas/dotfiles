import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import { homedir } from "node:os"

export const MAX_TOOL_OUTPUT = 80_000

export function managedStateDirectory() {
  return (
    process.env.OPENCODE_MANAGED_STATE_DIR ??
    join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "opencode-managed")
  )
}

export type HandMode = "primary" | "worker" | "reviewer"

export function stableHash(...values: string[]) {
  return createHash("sha256").update(values.join("\0")).digest("hex").slice(0, 16)
}

export function validHandID(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 48) {
    throw new Error("hand must contain lowercase letters, numbers, and single hyphens")
  }
  return value
}

export function resolveWorkspacePath(workspace: string, input: string) {
  if (typeof input !== "string" || input.length === 0) throw new Error("path must not be empty")
  const root = realpathSync(workspace)
  const target = resolve(root, input)
  const rel = relative(root, target)
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`path escapes the managed workspace: ${input}`)
  }
  return target
}

export function positionalSlice<Value>(values: Value[], start?: number, end?: number) {
  const normalize = (value: number | undefined, fallback: number) => {
    if (value === undefined) return fallback
    if (!Number.isInteger(value)) throw new Error("event positions must be integers")
    return value < 0 ? Math.max(values.length + value, 0) : Math.min(value, values.length)
  }
  const from = normalize(start, 0)
  const to = normalize(end, values.length)
  if (to < from) throw new Error("end must not precede start")
  if (to - from > 100) throw new Error("a session_events request may return at most 100 events")
  return values.slice(from, to)
}

const redactions: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]"],
  [/\b(?:sk|rk|pk)-(?:live|test|proj)?-?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/(\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
]

export function sanitizeOutput(value: string, maximum = MAX_TOOL_OUTPUT) {
  let result = value
  for (const [pattern, replacement] of redactions) result = result.replace(pattern, replacement)
  if (result.length > maximum) {
    let marker = ""
    let payload = maximum
    for (let attempt = 0; attempt < 3; attempt += 1) {
      marker = `\n[... ${result.length - payload} characters omitted ...]\n`
      payload = Math.max(0, maximum - marker.length)
    }
    if (payload === 0) return result.slice(0, maximum)
    const headLength = Math.ceil(payload / 2)
    const tailLength = Math.floor(payload / 2)
    const tail = tailLength === 0 ? "" : result.slice(-tailLength)
    return `${result.slice(0, headLength)}${marker}${tail}`
  }
  return result
}
