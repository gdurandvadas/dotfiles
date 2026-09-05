import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { BunCommandRunner } from "./process.ts"

describe("bounded command runner", () => {
  test("propagates successful output and exit codes", async () => {
    const runner = new BunCommandRunner()
    const result = await runner.run(["bash", "-lc", "printf hello; printf problem >&2; exit 7"])

    expect(result.exitCode).toBe(7)
    expect(result.stdout).toBe("hello")
    expect(result.stderr).toBe("problem")
    expect(result.timedOut).toBe(false)
    expect(result.aborted).toBe(false)
  })

  test("retains the beginning and end of bounded output", async () => {
    const runner = new BunCommandRunner()
    const result = await runner.run(
      ["bash", "-lc", "printf START; printf '%0500d' 0; printf END"],
      { outputLimitCharacters: 80 },
    )

    expect(result.stdout).toContain("START")
    expect(result.stdout).toContain("END")
    expect(result.stdout).toContain("characters omitted")
    expect(result.stdout.length).toBeLessThanOrEqual(80)
  })

  test("times out a command and terminates its descendant process group", async () => {
    const root = mkdtempSync(join(tmpdir(), "managed-timeout-"))
    const escaped = join(root, "escaped")
    const runner = new BunCommandRunner()
    const result = await runner.run(
      [
        "bash",
        "-lc",
        `trap '' TERM; (trap '' TERM; sleep 2; touch '${escaped}') & wait`,
      ],
      { timeoutMs: 40 },
    )

    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
    await Bun.sleep(1_100)
    expect(existsSync(escaped)).toBe(false)
  })

  test("drains noisy stdout and stderr without deadlocking", async () => {
    const runner = new BunCommandRunner()
    const result = await runner.run(
      [
        "bash",
        "-lc",
        "for stream in stdout stderr; do for i in {1..4000}; do if [[ $stream == stdout ]]; then printf 'out-%s\\n' \"$i\"; else printf 'err-%s\\n' \"$i\" >&2; fi; done; done",
      ],
      { outputLimitCharacters: 2_000, timeoutMs: 5_000 },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("out-1")
    expect(result.stdout).toContain("out-4000")
    expect(result.stderr).toContain("err-1")
    expect(result.stderr).toContain("err-4000")
  })

  test("keeps output lossless when no capture limit is requested", async () => {
    const runner = new BunCommandRunner()
    const result = await runner.run(["bash", "-lc", "printf '%020000d' 0"])
    expect(result.stdout).toHaveLength(20_000)
    expect(result.stdout).not.toContain("omitted")
  })

  test("honors caller cancellation", async () => {
    const runner = new BunCommandRunner()
    const controller = new AbortController()
    const running = runner.run(["bash", "-lc", "sleep 10"], {
      signal: controller.signal,
      timeoutMs: 5_000,
    })
    setTimeout(() => controller.abort(), 30)

    const result = await running
    expect(result.aborted).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(130)
  })

  test("keeps tiny output limits bounded", async () => {
    const runner = new BunCommandRunner()
    const result = await runner.run(["bash", "-lc", "printf abcdef"], {
      outputLimitCharacters: 1,
    })

    expect(result.stdout).toHaveLength(1)
  })
})
