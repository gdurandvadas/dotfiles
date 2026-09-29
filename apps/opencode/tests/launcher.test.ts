import { describe, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const launcher = new URL("../../scripts/oc.sh", import.meta.url).pathname

async function launch(args: string[], environment: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "managed-launcher-"))
  const bin = join(root, "bin")
  const config = join(root, ".config", "opencode-personal")
  const capture = join(root, "capture")
  mkdirSync(join(config, "node_modules", "@opencode-ai", "plugin"), { recursive: true })
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(config, "profile.jsonc"), "{}")
  writeFileSync(
    join(config, "node_modules", "@opencode-ai", "plugin", "package.json"),
    '{"version":"1.18.32"}',
  )
  writeFileSync(
    join(bin, "opencode"),
    "#!/bin/sh\nif [ \"$1\" = '--version' ]; then printf '%s\\n' \"${OPENCODE_TEST_VERSION:-1.18.32}\"; exit 0; fi\nprintf '%s\\n%s\\n%s\\n' \"$OPENCODE_MANAGED_BUDGET\" \"$OPENCODE_CONFIG\" \"$OPENCODE_CONFIG_CONTENT\" > \"$CAPTURE\"\nprintf '%s\\n' \"$@\" >> \"$CAPTURE\"\n",
  )
  chmodSync(join(bin, "opencode"), 0o755)

  const child = Bun.spawn([launcher, ...args], {
    env: {
      ...process.env,
      CAPTURE: capture,
      HOME: root,
      PATH: `${bin}:${process.env.PATH}`,
      ...environment,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return {
    capture: exists(capture) ? readFileSync(capture, "utf8") : "",
    exitCode,
    profile: join(config, "profile.jsonc"),
    stderr,
    stdout,
  }
}

function exists(path: string) {
  try {
    readFileSync(path)
    return true
  } catch {
    return false
  }
}

describe("oc budget profiles", () => {
  test("uses the small profile by default and preserves OpenCode arguments", async () => {
    const result = await launch(["--session", "session-1"])
    expect(result.exitCode).toBe(0)
    expect(result.capture).toContain(`small\n${result.profile}\n`)
    const [, , content] = result.capture.split("\n")
    expect(JSON.parse(content ?? "{}").agent).toEqual({
      managed: {
        model: "openai/gpt-5.6-terra",
        reasoningEffort: "medium",
        steps: 60,
      },
      "managed-worker": { steps: 48 },
      "managed-reviewer": { steps: 32 },
      "managed-plan": { steps: 32 },
    })
    expect(result.capture).toContain("--session\nsession-1\n")
  })

  test("applies a long inline step budget", async () => {
    const result = await launch(["--budget", "long", "--session", "session-1"])
    expect(result.exitCode).toBe(0)
    expect(result.capture).toContain("long\n")
    const [, , content] = result.capture.split("\n")
    expect(JSON.parse(content ?? "{}").agent).toEqual({
      managed: { steps: 400 },
      "managed-worker": { steps: 200 },
      "managed-reviewer": { steps: 96 },
      "managed-plan": { steps: 96 },
    })
    expect(result.capture).not.toContain("--budget")
  })

  test("rejects a missing profile value before launching OpenCode", async () => {
    const result = await launch(["--budget"])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain("requires small, standard, or long")
    expect(result.capture).toBe("")
  })

  test("rejects an unknown profile before launching OpenCode", async () => {
    const result = await launch(["--budget=huge"])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain("small, standard, or long")
    expect(result.capture).toBe("")
  })

  test("allows a patch-level OpenCode CLI update", async () => {
    const result = await launch([], { OPENCODE_TEST_VERSION: "1.18.33" })
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain("differs from plugin 1.18.32 by a patch release")
  })

  test("rejects an OpenCode CLI with an incompatible API version", async () => {
    const result = await launch([], { OPENCODE_TEST_VERSION: "1.19.0" })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("is incompatible with plugin 1.18.32")
    expect(result.capture).toBe("")
  })

  test("uses a project environment default and lets the CLI override it", async () => {
    const fromEnvironment = await launch([], { OPENCODE_MANAGED_BUDGET: "small" })
    expect(fromEnvironment.capture).toContain("small\n")
    const [, , content] = fromEnvironment.capture.split("\n")
    expect(JSON.parse(content ?? "{}").agent).toEqual({
      managed: {
        model: "openai/gpt-5.6-terra",
        reasoningEffort: "medium",
        steps: 60,
      },
      "managed-worker": { steps: 48 },
      "managed-reviewer": { steps: 32 },
      "managed-plan": { steps: 32 },
    })

    const overridden = await launch(["--budget=long"], {
      OPENCODE_MANAGED_BUDGET: "small",
    })
    expect(overridden.capture).toContain("long\n")
    expect(overridden.capture).toContain('"managed":{"steps":400}')
  })

  test("deep-merges a budget with an existing inline configuration", async () => {
    const result = await launch(["--budget=long"], {
      OPENCODE_CONFIG_CONTENT: '{"snapshot":true,"agent":{"managed":{"temperature":0.2}}}',
    })
    expect(result.exitCode).toBe(0)
    const [, , content] = result.capture.split("\n")
    expect(JSON.parse(content ?? "{}")).toEqual({
      snapshot: true,
      agent: {
        managed: { temperature: 0.2, steps: 400 },
        "managed-worker": { steps: 200 },
        "managed-reviewer": { steps: 96 },
        "managed-plan": { steps: 96 },
      },
    })
  })
})
