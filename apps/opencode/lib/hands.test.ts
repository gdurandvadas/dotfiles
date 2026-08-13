import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalHands, type HandSpec } from "./hands.ts"
import type { CommandOptions, CommandResult, CommandRunner } from "./process.ts"

class RecordingRunner implements CommandRunner {
  calls: Array<{ argv: string[]; options?: CommandOptions }> = []

  constructor(private readonly result: CommandResult = { exitCode: 0, stdout: "managed output", stderr: "" }) {}

  async run(argv: string[], options?: CommandOptions) {
    this.calls.push({ argv, options })
    return this.result
  }
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "managed-local-hands-"))
  const spec: HandSpec = {
    workspace: root,
    hand: "default",
    mode: "primary",
  }
  return { root, spec }
}

describe("local hands", () => {
  test("runs one shell command directly in the hand workspace", async () => {
    const runner = new RecordingRunner()
    const hands = new LocalHands(runner)
    const { spec } = fixture()

    expect(await hands.execute(spec, { name: "run", command: "pwd" })).toBe("managed output")
    expect(runner.calls).toEqual([
      {
        argv: ["bash", "-lc", "pwd"],
        options: { cwd: realpathSync(spec.workspace) },
      },
    ])
  })

  test("returns command failures without retrying", async () => {
    const runner = new RecordingRunner({ exitCode: 7, stdout: "", stderr: "failed once" })
    const hands = new LocalHands(runner)
    const { spec } = fixture()

    expect(await hands.execute(spec, { name: "run", command: "false" })).toBe(
      "[exit 7]\nfailed once",
    )
    expect(runner.calls).toHaveLength(1)
  })

  test("reads, writes, edits, and lists workspace files without provisioning", async () => {
    const hands = new LocalHands(new RecordingRunner())
    const { root, spec } = fixture()

    expect(await hands.execute(spec, { name: "write", path: "src/value.txt", content: "one\ntwo\n" })).toBe("ok")
    expect(await hands.execute(spec, { name: "read", path: "src/value.txt", offset: 1 })).toBe("two\n")
    expect(
      await hands.execute(spec, {
        name: "edit",
        path: "src/value.txt",
        oldText: "two",
        newText: "second",
      }),
    ).toBe("ok")
    expect(readFileSync(join(root, "src", "value.txt"), "utf8")).toBe("one\nsecond\n")
    expect(await hands.execute(spec, { name: "list", path: ".", depth: 2 })).toContain(
      "src/value.txt",
    )
  })

  test("rejects structured writes for reviewer hands", async () => {
    const runner = new RecordingRunner()
    const hands = new LocalHands(runner)
    const { spec } = fixture()

    await expect(
      hands.execute({ ...spec, mode: "reviewer" }, { name: "write", path: "x", content: "x" }),
    ).rejects.toThrow("read-only")
    expect(runner.calls).toHaveLength(0)
  })

  test("reports a logical hand as immediately ready", () => {
    const hands = new LocalHands(new RecordingRunner())
    const { spec } = fixture()
    expect(hands.status(spec)).toEqual({
      hand: "default",
      backend: "local",
      ready: true,
      mode: "primary",
    })
  })
})
