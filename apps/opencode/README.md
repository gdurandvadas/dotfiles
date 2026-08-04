# OpenCode v1 Wave Workflow

This profile turns OpenCode into a document-driven milestone orchestrator. Scheduling survives
restarts, compaction, interrupted sessions, and agent failures because no workflow phase lives in
memory.

## Start

Apply the dotfiles, then launch OpenCode from any Git repository:

```sh
dotfiles apply
oc
```

Use `/milestone-plan <outcome>` to research and seal a new execution contract. Open Waveboard with
`<leader>w` or `/waves` to inspect milestones, waves, ready tasks, and accepted checkpoints.

## Lifecycle

```text
/milestone-plan  →  sealed .opencode/plans/<slug>.md
                              │
                      /milestone-run
                              │
                     parallel ready wave
                              │
                         pm-agent audit
                              │
            docs/decisions/<date>-<slug>-wave-<n>.md
                              │
                     review, then continue
```

Each `/milestone-run` advances exactly one wave and stops after its checkpoint ADR. That boundary
keeps the user conversation product-facing while preserving detailed validation evidence in the
repository.

## Commands

| Command | Purpose |
| --- | --- |
| `/milestone-plan <outcome>` | Research dependencies and create a sealed contract |
| `/milestone-run [slug]` | Execute the next ready wave concurrently and audit it |
| `/milestone-audit [slug]` | Resume only the audit/checkpoint boundary |
| `/milestone-status [slug]` | Recompute progress from contracts and ADRs |
| `/waves` | Open the native Waveboard TUI route |

Waveboard keys:

| Key | Action |
| --- | --- |
| `enter` / `x` | Execute the selected milestone's ready wave |
| `a` | Audit the current wave |
| `s` | Ask for a textual status summary |
| `m` | Select another milestone |
| `p` | Plan a new milestone |
| `r` | Reload repository files |
| `q` / `escape` | Return to the OpenCode session |

## Trust boundaries

| Role | Source/tests | Plan contracts | Checkpoint ADRs | Delegation |
| --- | --- | --- | --- | --- |
| `plan` | denied | `workflow_contract` only | denied | read-only research only |
| `orchestrator` | denied | read-only | read-only | build agents + `pm-agent` |
| build agents | allowed | denied | denied | denied |
| `pm-agent` | denied | read-only | `workflow_checkpoint` only | denied |

The two write tools are role-gated, path-constrained, validated, and create files with exclusive
creation. A server hook also rejects ordinary edit, patch, write, or shell mutations that mention
`.opencode/plans` or `docs/decisions`. Agent instructions are therefore reinforced by executable
policy.

## Determinism and recovery

`workflow_contract` validates ids and dependencies, rejects unknown edges and cycles, and computes
canonical waves with Kahn's algorithm. Every zero-in-degree task available at an iteration is put
in the same stable wave.

`workflow_status` reparses all contracts and checkpoint ADRs on every invocation. The first wave
without an accepted ADR is ready; later waves are locked. No database, todo list, conversation
summary, child-session record, or plugin variable participates in that decision.

A sealed contract cannot be overwritten. Changed product scope requires a new slug. A checkpoint
can only accept the next ready wave and requires concrete validation evidence.

## Development

```sh
cd apps/opencode
bun install
bun test
bun run typecheck
```

The profile pins `@opencode-ai/plugin` to the installed OpenCode v1 release. The native dashboard
uses the OpenCode TUI plugin API, while prompt submission and notifications use the
[OpenCode SDK TUI client](https://opencode.ai/docs/sdk/#tui).
