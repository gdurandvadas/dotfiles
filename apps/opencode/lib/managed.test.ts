import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  positionalSlice,
  resolveWorkspacePath,
  sanitizeOutput,
} from "./managed.ts"

describe("session and security helpers", () => {
  test("supports positional and negative event slices", () => {
    expect(positionalSlice([0, 1, 2, 3], 1, 3)).toEqual([1, 2])
    expect(positionalSlice([0, 1, 2, 3], -2)).toEqual([2, 3])
    expect(() => positionalSlice(Array.from({ length: 101 }), 0, 101)).toThrow("at most 100")
  })

  test("redacts common credentials and caps persisted output", () => {
    const value = sanitizeOutput("Authorization: Bearer abc.def.ghi\napi_key=very-secret-value", 200)
    expect(value).not.toContain("abc.def.ghi")
    expect(value).not.toContain("very-secret-value")
    const bounded = sanitizeOutput(`START-${"x".repeat(100)}-END`, 60)
    expect(bounded).toContain("START")
    expect(bounded).toContain("END")
    expect(bounded).toContain("omitted")
    expect(bounded.length).toBeLessThanOrEqual(60)
  })

  test("contains structured hand paths within the workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "managed-paths-"))
    mkdirSync(join(root, "src"))
    expect(resolveWorkspacePath(root, "src")).toBe(join(realpathSync(root), "src"))
    expect(() => resolveWorkspacePath(root, "../outside")).toThrow("escapes")
  })
})
