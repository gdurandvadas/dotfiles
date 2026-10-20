import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { managedStateDirectory } from "./managed.ts"

const POLL_INTERVAL_MS = 100
const STALE_LOCK_MS = 2 * 60 * 60 * 1000

type LockOwner = {
  pid: number
  createdAt: string
  resource: string
}

export type ResourceLock = {
  resources: string[]
  waitMs: number
  release: () => void
}

export function validResourceID(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 64) {
    throw new Error("resource must contain lowercase letters, numbers, and single hyphens")
  }
  return value
}

function lockPath(resource: string) {
  return join(managedStateDirectory(), "locks", resource)
}

function owner(path: string): LockOwner | undefined {
  try {
    const value = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"))
    if (
      typeof value.pid !== "number" ||
      typeof value.createdAt !== "string" ||
      typeof value.resource !== "string"
    ) return undefined
    return value
  } catch {
    return undefined
  }
}

function processExists(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

function stale(path: string) {
  const current = owner(path)
  if (!current) return false
  const createdAt = Date.parse(current.createdAt)
  return !processExists(current.pid) || !Number.isFinite(createdAt) || Date.now() - createdAt > STALE_LOCK_MS
}

function wait(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("resource lock acquisition cancelled"))
      return
    }
    const timeout = setTimeout(resolve, delayMs)
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(new Error("resource lock acquisition cancelled"))
    }, { once: true })
  })
}

function release(path: string) {
  rmSync(path, { recursive: true, force: true })
}

async function acquire(resource: string, deadline: number, signal?: AbortSignal) {
  const path = lockPath(resource)
  mkdirSync(join(managedStateDirectory(), "locks"), { recursive: true })
  while (true) {
    if (signal?.aborted) throw new Error("resource lock acquisition cancelled")
    try {
      mkdirSync(path, { recursive: false })
      try {
        writeFileSync(join(path, "owner.json"), JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
          resource,
        }))
      } catch (error) {
        release(path)
        throw error
      }
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }

    if (stale(path)) {
      release(path)
      continue
    }
    if (Date.now() >= deadline) throw new Error(`timed out waiting for resource lock: ${resource}`)
    await wait(Math.min(POLL_INTERVAL_MS, deadline - Date.now()), signal)
  }
}

/**
 * Acquire named, cross-process locks in lexical order to avoid deadlocks. Resource names are
 * deliberately caller-supplied: only the project knows whether a command shares Docker, a test
 * database, or a compiler target directory with another command.
 */
export async function acquireResourceLocks(
  input: string[] | undefined,
  timeoutSeconds = 60,
  signal?: AbortSignal,
): Promise<ResourceLock | undefined> {
  if (!input?.length) return undefined
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) {
    throw new Error("resource lock timeout must be between 1 and 3600 seconds")
  }
  const resources = [...new Set(input.map(validResourceID))].sort()
  const paths: string[] = []
  const started = Date.now()
  const deadline = started + timeoutSeconds * 1000
  try {
    for (const resource of resources) paths.push(await acquire(resource, deadline, signal))
  } catch (error) {
    for (const path of paths.reverse()) release(path)
    throw error
  }
  return {
    resources,
    waitMs: Date.now() - started,
    release: () => {
      for (const path of paths.reverse()) release(path)
    },
  }
}
