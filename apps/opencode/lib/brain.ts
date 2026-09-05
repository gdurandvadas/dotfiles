import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { managedStateDirectory, stableHash } from "./managed.ts"
import { checked, type CommandRunner } from "./process.ts"
import { emitSessionNote, getRecentSessionEvents } from "./session.ts"

type OpenCodeClient = PluginInput["client"]
export type BrainRole = "worker" | "reviewer"

export function workerPath(projectRoot: string, sessionID: string) {
  return join(
    managedStateDirectory(),
    "worktrees",
    stableHash(projectRoot),
    sessionID,
  )
}

async function gitOutput(runner: CommandRunner, root: string, args: string[]) {
  return checked(runner, ["git", "-C", root, ...args])
}

export class ManagedBrains {
  constructor(
    private readonly client: OpenCodeClient,
    private readonly runner: CommandRunner,
    private readonly projectRoot: string,
  ) {}

  async assertClean() {
    const repo = await this.runner.run(["git", "-C", this.projectRoot, "rev-parse", "--show-toplevel"])
    if (repo.exitCode !== 0) throw new Error("mutating child brains require a Git repository")
    const status = await gitOutput(this.runner, this.projectRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ])
    if (status.stdout.trim()) {
      throw new Error(
        "mutating child brains require a clean primary checkout; commit or stash existing changes first",
      )
    }
  }

  async ensureWorker(sessionID: string, primaryAlreadyChecked = false) {
    const path = workerPath(this.projectRoot, sessionID)
    if (existsSync(path)) return path
    if (!primaryAlreadyChecked) await this.assertClean()
    mkdirSync(dirname(path), { recursive: true })
    await gitOutput(this.runner, this.projectRoot, ["worktree", "add", "--detach", path, "HEAD"])
    return path
  }

  async spawn(parentID: string, role: BrainRole, task: string, title?: string) {
    if (role === "worker") await this.assertClean()
    const created = await this.client.session.create({
      query: { directory: this.projectRoot },
      body: { parentID, title: title?.trim() || `Managed ${role}` },
    })
    if (!created.data) throw new Error(`unable to create child brain: ${JSON.stringify(created.error)}`)
    const child = created.data

    try {
      if (role === "worker") await this.ensureWorker(child.id, true)
      const prompted = await this.client.session.promptAsync({
        path: { id: child.id },
        query: { directory: this.projectRoot },
        body: {
          agent: role === "worker" ? "managed-worker" : "managed-reviewer",
          parts: [{ type: "text", text: task }],
        },
      })
      if (prompted.error) throw new Error(JSON.stringify(prompted.error))
      return child
    } catch (error) {
      if (role === "worker") await this.removeWorker(child.id).catch(() => undefined)
      throw error
    }
  }

  private async child(parentID: string, childID: string) {
    const response = await this.client.session.get({
      path: { id: childID },
      query: { directory: this.projectRoot },
    })
    if (!response.data || response.data.parentID !== parentID) {
      throw new Error(`${childID} is not a direct child of the current session`)
    }
    return response.data
  }

  async status(parentID: string, childID?: string) {
    const [statuses, children] = await Promise.all([
      this.client.session.status({ query: { directory: this.projectRoot } }),
      this.client.session.children({
        path: { id: parentID },
        query: { directory: this.projectRoot },
      }),
    ])
    if (!children.data) throw new Error("unable to list child brains")
    const selected = childID
      ? children.data.filter((child) => child.id === childID)
      : children.data
    if (childID && selected.length === 0) throw new Error(`${childID} is not a direct child`)
    return selected.map((child) => ({
      id: child.id,
      title: child.title,
      status: statuses.data?.[child.id]?.type ?? "idle",
      workerWorkspace: existsSync(workerPath(this.projectRoot, child.id)),
    }))
  }

  async collect(parentID: string, childID: string, tail = 12) {
    return getRecentSessionEvents(
      this.client,
      parentID,
      childID,
      this.projectRoot,
      tail,
    )
  }

  private async assertIdle(childID: string) {
    const statuses = await this.client.session.status({ query: { directory: this.projectRoot } })
    const state = statuses.data?.[childID]
    if (state && state.type !== "idle") throw new Error(`${childID} is ${state.type}, not idle`)
  }

  private async patch(childID: string) {
    const path = workerPath(this.projectRoot, childID)
    if (!existsSync(path)) throw new Error(`worker workspace does not exist for ${childID}`)
    const temporary = mkdtempSync(join(tmpdir(), "opencode-managed-index-"))
    const index = join(temporary, "index")
    const env = { GIT_INDEX_FILE: index }
    try {
      await checked(this.runner, ["git", "-C", path, "read-tree", "HEAD"], { env })
      await checked(this.runner, ["git", "-C", path, "add", "--all"], { env })
      const diff = await checked(
        this.runner,
        ["git", "-C", path, "diff", "--cached", "--binary", "--full-index", "HEAD"],
        { env },
      )
      return diff.stdout
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }

  async integrate(parentID: string, childID: string) {
    await this.child(parentID, childID)
    await this.assertIdle(childID)
    const patch = await this.patch(childID)
    if (!patch.trim()) return { applied: false, message: "worker produced no changes" }

    const check = await this.runner.run(
      ["git", "-C", this.projectRoot, "apply", "--check", "--binary", "-"],
      { stdin: patch },
    )
    if (check.exitCode !== 0) {
      throw new Error(`worker patch conflicts with the primary checkout: ${check.stderr || check.stdout}`)
    }
    await checked(
      this.runner,
      ["git", "-C", this.projectRoot, "apply", "--binary", "-"],
      { stdin: patch },
    )
    await this.removeWorker(childID)
    await emitSessionNote(
      this.client,
      childID,
      this.projectRoot,
      "Your worker patch was integrated into the primary checkout. " +
        "This worktree is finalized; spawn a new worker for further changes.",
    ).catch(() => undefined)
    return { applied: true, bytes: Buffer.byteLength(patch), message: "patch applied unstaged" }
  }

  async discard(parentID: string, childID: string) {
    await this.child(parentID, childID)
    await this.removeWorker(childID)
    await emitSessionNote(
      this.client,
      childID,
      this.projectRoot,
      "The parent discarded this worker worktree. The durable child session was retained.",
    ).catch(() => undefined)
  }

  async removeWorker(childID: string) {
    const path = workerPath(this.projectRoot, childID)
    if (!existsSync(path)) return
    await checked(this.runner, [
      "git",
      "-C",
      this.projectRoot,
      "worktree",
      "remove",
      "--force",
      path,
    ])
    await this.runner.run(["git", "-C", this.projectRoot, "worktree", "prune"])
  }
}
