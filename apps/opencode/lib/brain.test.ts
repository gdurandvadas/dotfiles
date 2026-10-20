import { afterEach, describe, expect, test } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { ManagedBrains, reviewerPath, workerPath } from "./brain.ts"
import { BunCommandRunner } from "./process.ts"

const originalState = process.env.OPENCODE_MANAGED_STATE_DIR

afterEach(() => {
  if (originalState === undefined) delete process.env.OPENCODE_MANAGED_STATE_DIR
  else process.env.OPENCODE_MANAGED_STATE_DIR = originalState
})

async function git(root: string, ...args: string[]) {
  const processHandle = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ])
  if (exitCode !== 0) throw new Error(stderr || stdout)
}

async function repository() {
  const root = mkdtempSync(join(tmpdir(), "managed-brain-"))
  process.env.OPENCODE_MANAGED_STATE_DIR = join(root, "state")
  await git(root, "init")
  writeFileSync(join(root, "tracked.txt"), "before\n")
  writeFileSync(join(root, "delete.txt"), "delete me\n")
  await git(root, "add", ".")
  await git(
    root,
    "-c",
    "user.name=Managed Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "base",
  )
  return root
}

function clients() {
  const notes: string[] = []
  const client = {
    session: {
      get: async () => ({ data: { id: "child", parentID: "parent" } }),
      status: async () => ({ data: { child: { type: "idle" } } }),
      promptAsync: async (input: { body?: { parts?: Array<{ text?: string }> } }) => {
        notes.push(input.body?.parts?.[0]?.text ?? "")
        return {}
      },
    },
  } as unknown as PluginInput["client"]
  return { client, notes }
}

describe("isolated worker integration", () => {
  test("applies tracked, deleted, new, and binary changes unstaged", async () => {
    const root = await repository()
    const { client, notes } = clients()
    const brains = new ManagedBrains(client, new BunCommandRunner(), root)
    const workspace = await brains.ensureWorker("child")
    writeFileSync(join(workspace, "tracked.txt"), "after\n")
    unlinkSync(join(workspace, "delete.txt"))
    writeFileSync(join(workspace, "new.bin"), new Uint8Array([0, 1, 2, 255]))

    const result = await brains.integrate("parent", "child")
    expect(result.applied).toBe(true)
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("after\n")
    expect(() => readFileSync(join(root, "delete.txt"))).toThrow()
    expect(Array.from(readFileSync(join(root, "new.bin")))).toEqual([0, 1, 2, 255])
    expect(notes[0]).toContain("integrated")
    expect(readFileSync(join(root, ".git", "index"))).toBeDefined()
  })

  test("refuses a dirty primary checkout before spawning a worker", async () => {
    const root = await repository()
    const { client } = clients()
    const brains = new ManagedBrains(client, new BunCommandRunner(), root)
    writeFileSync(join(root, "tracked.txt"), "dirty\n")
    await expect(brains.ensureWorker("child")).rejects.toThrow("clean primary checkout")
    expect(() => readFileSync(workerPath(root, "child"))).toThrow()
  })

  test("leaves both workspaces intact when patch checking conflicts", async () => {
    const root = await repository()
    const { client } = clients()
    const brains = new ManagedBrains(client, new BunCommandRunner(), root)
    const workspace = await brains.ensureWorker("child")
    writeFileSync(join(workspace, "tracked.txt"), "worker\n")
    writeFileSync(join(root, "tracked.txt"), "primary\n")
    await expect(brains.integrate("parent", "child")).rejects.toThrow(
      "conflicts",
    )
    expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("primary\n")
    expect(readFileSync(join(workspace, "tracked.txt"), "utf8")).toBe("worker\n")
    rmSync(root, { recursive: true, force: true })
  })

  test("binds reviewers to immutable snapshots and reports primary drift", async () => {
    const root = await repository()
    const child = "reviewer-child"
    const client = {
      session: {
        create: async () => ({ data: { id: child, title: "Review" } }),
        promptAsync: async () => ({}),
        status: async () => ({ data: { [child]: { type: "busy" } } }),
        children: async () => ({ data: [{ id: child, title: "Review" }] }),
      },
    } as unknown as PluginInput["client"]
    const brains = new ManagedBrains(client, new BunCommandRunner(), root)
    writeFileSync(join(root, "tracked.txt"), "review this\n")
    writeFileSync(join(root, "untracked.txt"), "snapshot this too\n")
    await brains.spawn("parent", "reviewer", "Review tracked.txt")

    const snapshot = reviewerPath(root, child)
    expect(readFileSync(join(snapshot, "tracked.txt"), "utf8")).toBe("review this\n")
    expect(readFileSync(join(snapshot, "untracked.txt"), "utf8")).toBe("snapshot this too\n")
    writeFileSync(join(root, "tracked.txt"), "changed after review started\n")

    const [status] = await brains.status("parent", child)
    expect(status).toMatchObject({
      role: "reviewer",
      reviewerWorkspace: true,
      stale: true,
    })
    expect(readFileSync(join(snapshot, "tracked.txt"), "utf8")).toBe("review this\n")
    await brains.removeReviewer(child)
  })

  test("cancels a reviewer and removes only its snapshot", async () => {
    const root = await repository()
    const child = "reviewer-child"
    let aborted = false
    const client = {
      session: {
        create: async () => ({ data: { id: child, title: "Review" } }),
        promptAsync: async () => ({}),
        get: async () => ({ data: { id: child, parentID: "parent" } }),
        abort: async () => {
          aborted = true
          return {}
        },
      },
    } as unknown as PluginInput["client"]
    const brains = new ManagedBrains(client, new BunCommandRunner(), root)
    await brains.spawn("parent", "reviewer", "Review tracked.txt")
    expect(existsSync(reviewerPath(root, child))).toBe(true)

    await expect(brains.cancel("parent", child)).resolves.toMatchObject({
      cancelled: true,
      reviewerWorkspaceRemoved: true,
    })
    expect(aborted).toBe(true)
    expect(existsSync(reviewerPath(root, child))).toBe(false)
  })
})
