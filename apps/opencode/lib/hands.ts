import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { dirname, relative } from "node:path"
import {
  resolveWorkspacePath,
  sanitizeOutput,
  validHandID,
  type HandMode,
} from "./managed.ts"
import type { CommandResult, CommandRunner } from "./process.ts"

export type HandSpec = {
  workspace: string
  hand: string
  mode: HandMode
}

export type HandOperation =
  | { name: "run"; command: string }
  | { name: "read"; path: string; offset?: number; limit?: number }
  | { name: "write"; path: string; content: string }
  | { name: "edit"; path: string; oldText: string; newText: string; replaceAll?: boolean }
  | { name: "search"; query: string; path?: string; glob?: string }
  | { name: "list"; path?: string; depth?: number }

function lines(result: CommandResult) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
}

function assertWritable(spec: HandSpec) {
  if (spec.mode === "reviewer") throw new Error("reviewer hands are read-only")
}

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1
}

function listPaths(workspace: string, input: string, maximumDepth: number) {
  const target = resolveWorkspacePath(workspace, input)
  const output: string[] = []
  const visit = (path: string, depth: number) => {
    const label = relative(workspace, path) || "."
    output.push(label)
    const stat = lstatSync(path)
    if (!stat.isDirectory() || stat.isSymbolicLink() || depth >= maximumDepth) return
    for (const entry of readdirSync(path).sort()) {
      visit(resolveWorkspacePath(workspace, `${label}/${entry}`), depth + 1)
    }
  }
  visit(target, 0)
  return output.join("\n")
}

/**
 * Executes hand operations directly in the OpenCode environment. The process running OpenCode is
 * the trust boundary; hand names are logical labels and do not provision separate runtimes.
 */
export class LocalHands {
  constructor(private readonly runner: CommandRunner) {}

  status(spec: HandSpec) {
    validHandID(spec.hand)
    realpathSync(spec.workspace)
    return {
      hand: spec.hand,
      backend: "local",
      ready: true,
      mode: spec.mode,
    }
  }

  async execute(spec: HandSpec, operation: HandOperation) {
    validHandID(spec.hand)
    const workspace = realpathSync(spec.workspace)
    let result: CommandResult | undefined
    let output: string

    if (operation.name === "run") {
      result = await this.runner.run(["bash", "-lc", operation.command], { cwd: workspace })
      output = lines(result)
    } else if (operation.name === "read") {
      const path = resolveWorkspacePath(workspace, operation.path)
      const data = readFileSync(path)
      if (data.includes(0)) {
        output = `<binary file: ${data.length} bytes>`
      } else {
        const offset = Math.max(0, operation.offset ?? 0)
        const limit = Math.min(Math.max(1, operation.limit ?? 2000), 10_000)
        output = data.toString("utf8").split(/(?<=\n)/).slice(offset, offset + limit).join("")
      }
    } else if (operation.name === "write") {
      assertWritable(spec)
      const path = resolveWorkspacePath(workspace, operation.path)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, operation.content)
      output = "ok"
    } else if (operation.name === "edit") {
      assertWritable(spec)
      const path = resolveWorkspacePath(workspace, operation.path)
      const source = readFileSync(path, "utf8")
      const matches = countOccurrences(source, operation.oldText)
      if (matches === 0) throw new Error("oldText was not found")
      if (!operation.replaceAll && matches !== 1) {
        throw new Error(`oldText matched ${matches} times; set replaceAll to replace every match`)
      }
      writeFileSync(
        path,
        operation.replaceAll
          ? source.split(operation.oldText).join(operation.newText)
          : source.replace(operation.oldText, operation.newText),
      )
      output = "ok"
    } else if (operation.name === "search") {
      const path = resolveWorkspacePath(workspace, operation.path ?? ".")
      const argv = ["rg", "--line-number", "--color", "never"]
      if (operation.glob) argv.push("--glob", operation.glob)
      argv.push("--", operation.query, relative(workspace, path) || ".")
      result = await this.runner.run(argv, { cwd: workspace })
      if (result.exitCode === 1 && !result.stderr) return "no matches"
      output = lines(result)
    } else {
      const depth = Math.min(Math.max(1, operation.depth ?? 3), 8)
      output = listPaths(workspace, operation.path ?? ".", depth)
    }

    const sanitized = sanitizeOutput(output)
    if (!result || result.exitCode === 0) return sanitized || "ok"
    return `[exit ${result.exitCode}]\n${sanitized || "command failed without output"}`
  }
}
