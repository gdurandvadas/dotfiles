import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { Buffer } from "node:buffer"
import { basename, join, relative } from "node:path"

export const WORKFLOW_VERSION = 1
export const BUILD_AGENTS = ["build-backend", "build-frontend", "build-general"] as const

export type BuildAgent = (typeof BUILD_AGENTS)[number]

export type TaskDraft = {
  id: string
  title: string
  agent: BuildAgent
  dependencies: string[]
  scope: string
  acceptance: string
  validation: string[]
}

export type ContractDraft = {
  slug: string
  title: string
  objective: string
  acceptance: string[]
  nonGoals: string[]
  tasks: TaskDraft[]
}

export type Wave = {
  number: number
  taskIds: string[]
}

export type Contract = ContractDraft & {
  version: number
  createdAt: string
  waves: Wave[]
}

export type ValidationEvidence = {
  command: string
  result: "passed" | "skipped"
  evidence: string
}

export type CheckpointDraft = {
  milestone: string
  wave: number
  summary: string
  productImpact: string
  decisions: string[]
  validation: ValidationEvidence[]
  followUps: string[]
}

export type Checkpoint = CheckpointDraft & {
  version: number
  createdAt: string
  outcome: "accepted"
}

export type MilestoneState = {
  contract: Contract
  planPath: string
  checkpoints: Checkpoint[]
  currentWave?: Wave
  completed: boolean
}

const contractMarker = /<!-- opencode-workflow-contract:v1:([A-Za-z0-9_-]+) -->/
const checkpointMarker = /<!-- opencode-workflow-checkpoint:v1:([A-Za-z0-9_-]+) -->/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const taskPattern = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/

function assertText(value: string, name: string, max = 1000) {
  const result = value.trim()
  if (!result) throw new Error(`${name} must not be empty`)
  if (result.length > max) throw new Error(`${name} must be at most ${max} characters`)
  return result
}

function cleanList(values: string[], name: string, maxItems = 32) {
  if (values.length > maxItems) throw new Error(`${name} may contain at most ${maxItems} items`)
  return values.map((value, index) => assertText(value, `${name}[${index}]`))
}

export function validateDraft(input: ContractDraft): ContractDraft {
  const slug = assertText(input.slug, "slug", 80)
  if (!slugPattern.test(slug)) {
    throw new Error("slug must contain lowercase letters, numbers, and single hyphens")
  }
  if (input.tasks.length === 0) throw new Error("a milestone needs at least one task")
  if (input.tasks.length > 64) throw new Error("a milestone may contain at most 64 tasks")

  const ids = new Set<string>()
  const tasks = input.tasks.map((task, index) => {
    const id = assertText(task.id, `tasks[${index}].id`, 40)
    if (!taskPattern.test(id)) {
      throw new Error(`task id ${id} must use uppercase letters, numbers, and hyphens`)
    }
    if (ids.has(id)) throw new Error(`duplicate task id: ${id}`)
    ids.add(id)
    if (!BUILD_AGENTS.includes(task.agent)) throw new Error(`unsupported build agent for ${id}`)
    if (task.validation.length === 0) throw new Error(`${id} needs at least one validation command`)
    return {
      id,
      title: assertText(task.title, `${id}.title`, 160),
      agent: task.agent,
      dependencies: [...task.dependencies],
      scope: assertText(task.scope, `${id}.scope`, 1200),
      acceptance: assertText(task.acceptance, `${id}.acceptance`, 1200),
      validation: cleanList(task.validation, `${id}.validation`, 16),
    }
  })

  for (const task of tasks) {
    const seen = new Set<string>()
    task.dependencies = task.dependencies.map((dependency) => assertText(dependency, `${task.id}.dependency`, 40))
    for (const dependency of task.dependencies) {
      if (!ids.has(dependency)) throw new Error(`${task.id} depends on unknown task ${dependency}`)
      if (dependency === task.id) throw new Error(`${task.id} cannot depend on itself`)
      if (seen.has(dependency)) throw new Error(`${task.id} repeats dependency ${dependency}`)
      seen.add(dependency)
    }
  }

  return {
    slug,
    title: assertText(input.title, "title", 160),
    objective: assertText(input.objective, "objective", 2000),
    acceptance: cleanList(input.acceptance, "acceptance"),
    nonGoals: cleanList(input.nonGoals, "nonGoals"),
    tasks,
  }
}

export function computeWaves(tasks: TaskDraft[]): Wave[] {
  const order = new Map(tasks.map((task, index) => [task.id, index]))
  const indegree = new Map(tasks.map((task) => [task.id, task.dependencies.length]))
  const outgoing = new Map(tasks.map((task) => [task.id, [] as string[]]))

  for (const task of tasks) {
    for (const dependency of task.dependencies) outgoing.get(dependency)?.push(task.id)
  }

  const sort = (left: string, right: string) => (order.get(left) ?? 0) - (order.get(right) ?? 0)
  let ready = tasks.filter((task) => task.dependencies.length === 0).map((task) => task.id).sort(sort)
  const waves: Wave[] = []
  let visited = 0

  while (ready.length > 0) {
    const taskIds = ready
    waves.push({ number: waves.length + 1, taskIds })
    visited += taskIds.length
    const next: string[] = []
    for (const taskId of taskIds) {
      for (const dependent of outgoing.get(taskId) ?? []) {
        const degree = (indegree.get(dependent) ?? 0) - 1
        indegree.set(dependent, degree)
        if (degree === 0) next.push(dependent)
      }
    }
    ready = next.sort(sort)
  }

  if (visited !== tasks.length) {
    const blocked = tasks.filter((task) => (indegree.get(task.id) ?? 0) > 0).map((task) => task.id)
    throw new Error(`dependency cycle detected among: ${blocked.join(", ")}`)
  }
  return waves
}

export function createContract(input: ContractDraft, createdAt = new Date().toISOString()): Contract {
  const draft = validateDraft(input)
  return { ...draft, version: WORKFLOW_VERSION, createdAt, waves: computeWaves(draft.tasks) }
}

function inline(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|")
}

function list(values: string[], empty: string) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

function decode<Value>(value: string): Value {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Value
}

export function serializeContract(contract: Contract) {
  const byId = new Map(contract.tasks.map((task) => [task.id, task]))
  const graph = contract.tasks
    .flatMap((task, index) => {
      if (task.dependencies.length === 0) return [`  task${index}["${inline(task.id)} · ${inline(task.title)}"]`]
      return task.dependencies.map((dependency) => {
        const parent = contract.tasks.findIndex((candidate) => candidate.id === dependency)
        return `  task${parent}["${inline(dependency)}"] --> task${index}["${inline(task.id)} · ${inline(task.title)}"]`
      })
    })
    .join("\n")
  const waves = contract.waves
    .map((wave) => {
      const tasks = wave.taskIds
        .map((taskId) => {
          const task = byId.get(taskId)
          if (!task) throw new Error(`contract references missing task ${taskId}`)
          return [
            `### ${task.id} — ${task.title}`,
            `- Agent: \`${task.agent}\``,
            `- Depends on: ${
              task.dependencies.length
                ? task.dependencies.map((item) => `\`${item}\``).join(", ")
                : "none"
            }`,
            `- Scope: ${task.scope}`,
            `- Acceptance: ${task.acceptance}`,
            "- Validation:",
            ...task.validation.map((command) => `  - \`${command}\``),
          ].join("\n")
        })
        .join("\n\n")
      return `## Wave ${wave.number}\n\n${tasks}`
    })
    .join("\n\n")

  return `---
workflow: opencode-milestone
version: ${contract.version}
milestone: ${contract.slug}
state: sealed
created_at: ${contract.createdAt}
---

# ${contract.title}

> Immutable execution contract. Amendments require a new milestone contract.

## Objective

${contract.objective}

## Product acceptance

${list(contract.acceptance, "No additional acceptance criteria")}

## Non-goals

${list(contract.nonGoals, "None")}

## Dependency graph

\`\`\`mermaid
graph LR
${graph}
\`\`\`

${waves}

<!-- opencode-workflow-contract:v1:${encode(contract)} -->
`
}

export function parseContract(markdown: string): Contract {
  const match = markdown.match(contractMarker)
  if (!match) throw new Error("missing opencode workflow contract marker")
  const parsed = decode<Contract>(match[1])
  if (parsed.version !== WORKFLOW_VERSION) throw new Error(`unsupported contract version ${parsed.version}`)
  const rebuilt = createContract(parsed, parsed.createdAt)
  if (JSON.stringify(rebuilt.waves) !== JSON.stringify(parsed.waves)) {
    throw new Error("serialized waves do not match the dependency graph")
  }
  return rebuilt
}

export function serializeCheckpoint(checkpoint: Checkpoint, contractPath: string) {
  const evidence = checkpoint.validation
    .map((item) => `| \`${inline(item.command)}\` | ${item.result} | ${inline(item.evidence)} |`)
    .join("\n")
  return `---
workflow: opencode-wave-checkpoint
version: ${checkpoint.version}
milestone: ${checkpoint.milestone}
wave: ${checkpoint.wave}
outcome: ${checkpoint.outcome}
contract: ${contractPath}
created_at: ${checkpoint.createdAt}
---

# ADR: ${checkpoint.milestone} · Wave ${checkpoint.wave}

## Product outcome

${checkpoint.productImpact}

## Engineering summary

${checkpoint.summary}

## Decisions

${list(checkpoint.decisions, "No new architecture decisions")}

## Validation evidence

| Command | Result | Evidence |
| --- | --- | --- |
${evidence}

## Follow-ups

${list(checkpoint.followUps, "None")}

<!-- opencode-workflow-checkpoint:v1:${encode(checkpoint)} -->
`
}

export function parseCheckpoint(markdown: string): Checkpoint {
  const match = markdown.match(checkpointMarker)
  if (!match) throw new Error("missing opencode workflow checkpoint marker")
  const parsed = decode<Checkpoint>(match[1])
  if (parsed.version !== WORKFLOW_VERSION) throw new Error(`unsupported checkpoint version ${parsed.version}`)
  if (!slugPattern.test(parsed.milestone)) throw new Error("invalid checkpoint milestone")
  if (!Number.isSafeInteger(parsed.wave) || parsed.wave < 1) throw new Error("invalid checkpoint wave")
  if (parsed.outcome !== "accepted") throw new Error("checkpoint outcome must be accepted")
  if (parsed.validation.length === 0) throw new Error("checkpoint validation evidence is empty")
  return {
    ...parsed,
    summary: assertText(parsed.summary, "summary", 4000),
    productImpact: assertText(parsed.productImpact, "productImpact", 4000),
    decisions: cleanList(parsed.decisions, "decisions"),
    validation: parsed.validation.map((item, index) => ({
      command: assertText(item.command, `validation[${index}].command`, 500),
      result:
        item.result === "passed" || item.result === "skipped"
          ? item.result
          : (() => {
              throw new Error(`validation[${index}].result is invalid`)
            })(),
      evidence: assertText(item.evidence, `validation[${index}].evidence`, 1000),
    })),
    followUps: cleanList(parsed.followUps, "followUps"),
  }
}

function rootFor(directory: string, worktree: string) {
  return worktree && worktree !== "/" ? worktree : directory
}

export function workspaceRoot(context: { directory: string; worktree: string }) {
  return rootFor(context.directory, context.worktree)
}

export function planPath(root: string, slug: string) {
  if (!slugPattern.test(slug)) throw new Error("invalid milestone slug")
  return join(root, ".opencode", "plans", `${slug}.md`)
}

export function writeContract(root: string, contract: Contract) {
  const path = planPath(root, contract.slug)
  mkdirSync(join(root, ".opencode", "plans"), { recursive: true })
  writeFileSync(path, serializeContract(contract), { encoding: "utf8", flag: "wx" })
  return path
}

export function checkpointFile(root: string, slug: string, wave: number, createdAt: string) {
  if (!slugPattern.test(slug)) throw new Error("invalid milestone slug")
  if (!Number.isSafeInteger(wave) || wave < 1) throw new Error("wave must be a positive integer")
  const date = createdAt.slice(0, 10)
  return join(root, "docs", "decisions", `${date}-${slug}-wave-${wave}.md`)
}

export function readStates(root: string): MilestoneState[] {
  const plans = join(root, ".opencode", "plans")
  if (!existsSync(plans)) return []
  const contracts = readdirSync(plans)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const path = join(plans, name)
      return { path, contract: parseContract(readFileSync(path, "utf8")) }
    })
  const decisions = join(root, "docs", "decisions")
  const checkpoints = existsSync(decisions)
    ? readdirSync(decisions)
        .filter((name) => name.endsWith(".md"))
        .flatMap((name) => {
          try {
            return [parseCheckpoint(readFileSync(join(decisions, name), "utf8"))]
          } catch {
            return []
          }
        })
    : []

  return contracts
    .map(({ path, contract }) => {
      const matching = checkpoints
        .filter((checkpoint) => checkpoint.milestone === contract.slug && checkpoint.outcome === "accepted")
        .sort((left, right) => left.wave - right.wave)
      const byWave = new Map<number, Checkpoint>()
      for (const checkpoint of matching) {
        if (!contract.waves.some((wave) => wave.number === checkpoint.wave)) {
          throw new Error(`${contract.slug} has a checkpoint for unknown wave ${checkpoint.wave}`)
        }
        if (byWave.has(checkpoint.wave)) {
          throw new Error(`${contract.slug} has duplicate checkpoints for wave ${checkpoint.wave}`)
        }
        byWave.set(checkpoint.wave, checkpoint)
      }
      const accepted: Checkpoint[] = []
      for (const wave of contract.waves) {
        const checkpoint = byWave.get(wave.number)
        if (!checkpoint) break
        accepted.push(checkpoint)
      }
      const next = contract.waves.find((wave) => !accepted.some((checkpoint) => checkpoint.wave === wave.number))
      return {
        contract,
        planPath: relative(root, path),
        checkpoints: accepted,
        currentWave: next,
        completed: next === undefined,
      }
    })
    .sort((left, right) => right.contract.createdAt.localeCompare(left.contract.createdAt))
}

export function selectState(root: string, slug?: string) {
  const states = readStates(root)
  const state = slug ? states.find((candidate) => candidate.contract.slug === slug) : states[0]
  if (!state) throw new Error(slug ? `milestone not found: ${slug}` : "no milestone contracts found")
  return state
}

export function createCheckpoint(
  root: string,
  input: CheckpointDraft,
  createdAt = new Date().toISOString(),
) {
  const state = selectState(root, input.milestone)
  if (!state.currentWave) throw new Error(`milestone ${input.milestone} is already complete`)
  if (input.wave !== state.currentWave.number) {
    throw new Error(`wave ${input.wave} is not ready; next checkpoint is wave ${state.currentWave.number}`)
  }
  if (input.validation.length === 0) throw new Error("a checkpoint requires validation evidence")
  const checkpoint: Checkpoint = {
    version: WORKFLOW_VERSION,
    milestone: input.milestone,
    wave: input.wave,
    summary: assertText(input.summary, "summary", 4000),
    productImpact: assertText(input.productImpact, "productImpact", 4000),
    decisions: cleanList(input.decisions, "decisions"),
    validation: input.validation.map((item, index) => ({
      command: assertText(item.command, `validation[${index}].command`, 500),
      result: item.result,
      evidence: assertText(item.evidence, `validation[${index}].evidence`, 1000),
    })),
    followUps: cleanList(input.followUps, "followUps"),
    createdAt,
    outcome: "accepted",
  }
  const path = checkpointFile(root, checkpoint.milestone, checkpoint.wave, createdAt)
  mkdirSync(join(root, "docs", "decisions"), { recursive: true })
  writeFileSync(path, serializeCheckpoint(checkpoint, state.planPath), { encoding: "utf8", flag: "wx" })
  return { checkpoint, path }
}

export function stateSummary(state: MilestoneState) {
  const lines = [
    `${state.contract.title} (${state.contract.slug})`,
    `Contract: ${state.planPath}`,
    `Progress: ${state.checkpoints.length}/${state.contract.waves.length} waves accepted`,
  ]
  if (state.completed) lines.push("Status: complete")
  else {
    lines.push(`Ready: Wave ${state.currentWave?.number}`)
    for (const taskId of state.currentWave?.taskIds ?? []) {
      const task = state.contract.tasks.find((candidate) => candidate.id === taskId)
      if (task) lines.push(`- ${task.id} [${task.agent}] ${task.title}`)
    }
  }
  return lines.join("\n")
}

export function shortName(path: string) {
  return basename(path, ".md")
}
