import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalHands, type HandSpec } from "../lib/hands.ts"
import { BunCommandRunner } from "../lib/process.ts"

test("real local hand uses the workspace and OpenCode environment", async () => {
  const root = mkdtempSync(join(tmpdir(), "managed-local-smoke-"))
  const key = "OPENCODE_LOCAL_HAND_SMOKE"
  const previous = process.env[key]
  process.env[key] = "inherited"
  const spec: HandSpec = {
    workspace: root,
    hand: "default",
    mode: "primary",
  }
  const hands = new LocalHands(new BunCommandRunner())

  try {
    expect(await hands.execute(spec, { name: "run", command: "pwd" })).toBe(realpathSync(root))
    expect(await hands.execute(spec, { name: "run", command: `printf %s \"$${key}\"` })).toBe(
      "inherited",
    )
    expect(
      await hands.execute(spec, { name: "write", path: "from-hand.txt", content: "managed\n" }),
    ).toBe("ok")
    expect(readFileSync(join(root, "from-hand.txt"), "utf8")).toBe("managed\n")
  } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
})
