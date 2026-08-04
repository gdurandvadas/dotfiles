import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  computeWaves,
  createCheckpoint,
  createContract,
  parseCheckpoint,
  parseContract,
  readStates,
  serializeContract,
  stateSummary,
  writeContract,
  type ContractDraft,
  type TaskDraft,
} from "./workflow.ts"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "opencode-workflow-"))
  roots.push(root)
  return root
}

function task(id: string, dependencies: string[] = []): TaskDraft {
  return {
    id,
    title: `Task ${id}`,
    agent: "build-general",
    dependencies,
    scope: `Implement ${id}`,
    acceptance: `${id} works`,
    validation: [`test ${id}`],
  }
}

function draft(tasks: TaskDraft[]): ContractDraft {
  return {
    slug: "durable-workflow",
    title: "Durable workflow",
    objective: "Recover scheduling state from repository files after every restart.",
    acceptance: ["Ready work is derived deterministically"],
    nonGoals: ["Background task databases"],
    tasks,
  }
}

describe("Kahn wave scheduling", () => {
  test("places every simultaneously ready task in the same stable wave", () => {
    const tasks = [task("API"), task("UI"), task("WIRE", ["API", "UI"]), task("DOCS", ["API"])]
    expect(computeWaves(tasks)).toEqual([
      { number: 1, taskIds: ["API", "UI"] },
      { number: 2, taskIds: ["WIRE", "DOCS"] },
    ])
  })

  test("rejects cycles with the blocked task ids", () => {
    const input = [task("A", ["B"]), task("B", ["A"])]
    expect(() => computeWaves(input)).toThrow("dependency cycle detected among: A, B")
  })

  test("rejects unknown and duplicate dependencies before scheduling", () => {
    expect(() => createContract(draft([task("A", ["MISSING"])]))).toThrow("unknown task MISSING")
    expect(() => createContract(draft([task("A"), task("B", ["A", "A"])]))).toThrow(
      "repeats dependency A",
    )
  })
})

describe("immutable workflow files", () => {
  test("round-trips the human-readable Markdown contract", () => {
    const contract = createContract(draft([task("A"), task("B", ["A"])]), "2026-08-03T10:00:00.000Z")
    const markdown = serializeContract(contract)
    expect(markdown).toContain("state: sealed")
    expect(markdown).toContain("## Wave 1")
    expect(markdown).toContain("## Wave 2")
    expect(parseContract(markdown)).toEqual(contract)
  })

  test("creates a contract once and refuses overwrite", () => {
    const root = tempRoot()
    const contract = createContract(draft([task("A")]), "2026-08-03T10:00:00.000Z")
    const path = writeContract(root, contract)
    expect(parseContract(readFileSync(path, "utf8"))).toEqual(contract)
    expect(() => writeContract(root, contract)).toThrow()
  })

  test("recovers readiness solely from the contract and checkpoint ADRs", () => {
    const root = tempRoot()
    const contract = createContract(draft([task("A"), task("B", ["A"])]), "2026-08-03T10:00:00.000Z")
    writeContract(root, contract)

    let state = readStates(root)[0]
    expect(state.currentWave?.number).toBe(1)
    expect(state.completed).toBe(false)

    const first = createCheckpoint(
      root,
      {
        milestone: contract.slug,
        wave: 1,
        summary: "Implemented A.",
        productImpact: "The first capability is available.",
        decisions: [],
        validation: [{ command: "test A", result: "passed", evidence: "1 test passed" }],
        followUps: [],
      },
      "2026-08-03T11:00:00.000Z",
    )
    expect(parseCheckpoint(readFileSync(first.path, "utf8")).wave).toBe(1)

    state = readStates(root)[0]
    expect(state.currentWave?.number).toBe(2)
    expect(stateSummary(state)).toContain("Ready: Wave 2")

    createCheckpoint(
      root,
      {
        milestone: contract.slug,
        wave: 2,
        summary: "Implemented B.",
        productImpact: "The milestone is complete.",
        decisions: ["Use immutable ADRs as checkpoints"],
        validation: [{ command: "test B", result: "passed", evidence: "1 test passed" }],
        followUps: [],
      },
      "2026-08-03T12:00:00.000Z",
    )

    state = readStates(root)[0]
    expect(state.completed).toBe(true)
    expect(state.currentWave).toBeUndefined()
    expect(stateSummary(state)).toContain("Status: complete")
  })

  test("will only accept the next ready wave", () => {
    const root = tempRoot()
    writeContract(root, createContract(draft([task("A"), task("B", ["A"])])))
    expect(() =>
      createCheckpoint(root, {
        milestone: "durable-workflow",
        wave: 2,
        summary: "Skipped ahead.",
        productImpact: "Invalid.",
        decisions: [],
        validation: [{ command: "test", result: "passed", evidence: "passed" }],
        followUps: [],
      }),
    ).toThrow("wave 2 is not ready; next checkpoint is wave 1")
  })
})
