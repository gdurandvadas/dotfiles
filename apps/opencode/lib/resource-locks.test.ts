import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireResourceLocks, validResourceID } from "./resource-locks.ts"

const originalState = process.env.OPENCODE_MANAGED_STATE_DIR
let state: string | undefined

afterEach(() => {
  if (state) rmSync(state, { recursive: true, force: true })
  state = undefined
  if (originalState === undefined) delete process.env.OPENCODE_MANAGED_STATE_DIR
  else process.env.OPENCODE_MANAGED_STATE_DIR = originalState
})

function isolatedState() {
  state = mkdtempSync(join(tmpdir(), "managed-resource-lock-"))
  process.env.OPENCODE_MANAGED_STATE_DIR = state
}

describe("resource locks", () => {
  test("rejects unsafe resource names", () => {
    expect(() => validResourceID("Docker daemon")).toThrow("resource must contain")
    expect(validResourceID("docker-daemon")).toBe("docker-daemon")
  })

  test("serializes and releases named resources", async () => {
    isolatedState()
    const first = await acquireResourceLocks(["docker-daemon", "cargo-target"])
    expect(first?.resources).toEqual(["cargo-target", "docker-daemon"])
    await expect(acquireResourceLocks(["docker-daemon"], 1)).rejects.toThrow("timed out")
    first?.release()
    const second = await acquireResourceLocks(["docker-daemon"])
    second?.release()
    expect(existsSync(join(state ?? "", "locks", "docker-daemon"))).toBe(false)
  })
})
