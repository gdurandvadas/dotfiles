import { describe, expect, test } from "bun:test"
import { guardProtectedPaths } from "../lib/protection.ts"

describe("protected workflow paths", () => {
  test("blocks ordinary file mutation tools", () => {
    expect(() => guardProtectedPaths("edit", { filePath: ".opencode/plans/release.md" })).toThrow(
      "workflow-owned and immutable",
    )
    expect(() => guardProtectedPaths("apply_patch", { path: "docs/decisions/checkpoint.md" })).toThrow(
      "workflow-owned and immutable",
    )
  })

  test("blocks shell mutation attempts even in auto-approve mode", () => {
    expect(() =>
      guardProtectedPaths("bash", { command: "printf tampered > .opencode/plans/release.md" }),
    ).toThrow("workflow-owned and immutable")
  })

  test("allows protected reads and ordinary source edits", () => {
    expect(() => guardProtectedPaths("read", { filePath: ".opencode/plans/release.md" })).not.toThrow()
    expect(() => guardProtectedPaths("edit", { filePath: "src/release.ts" })).not.toThrow()
  })
})
