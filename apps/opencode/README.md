# OpenCode Personal Profile

Personal OpenCode configuration for bounded standalone work and durable schema-v4 projects. Launch
it with `oc-pers`; Home Manager links this directory into the active configuration.

## Entry points

| Flow | Entry | Use |
|---|---|---|
| Standalone | `@default` | One bounded change outside project state |
| Project | `/project <name-or-id>` | Approved milestones, isolated tasks, and integration gates |

`/project` is the complete project interface. A new name starts requirements discovery; an exact ID
or numeric prefix resumes; no argument lists current v4 projects. Schema-v3 and earlier records are
ignored and rejected when addressed directly. They are never migrated.

## Ownership

OpenCode owns workflow safety, requirements approval, worktree isolation, scope enforcement,
reasoning-tier routing, evidence execution, logs, integration, and recovery. The managed
repository owns implementation, architecture, and verification policy through its root and
applicable child `AGENTS.md` files.

Planning reads those repository instructions and stores their exact evidence commands in the
approved manifest. The runtime treats commands as opaque argument arrays; it contains no
repository, framework, language, or command-name classification.

## Agents

| Agent | Model | Responsibility |
|---|---|---|
| `default` | Terra | Standalone bounded work |
| `orchestrate` | Terra | Requirements, planning, routing, state, integration, and recovery |
| `investigate` | Luna | Narrow static read-only research |
| `diagnose` | Terra | Failure reproduction and root-cause diagnosis without edits |
| `implement-s` | Luna | Exact, low-ambiguity changes following an established pattern |
| `implement-m` | Terra | Default ordinary component and multi-file implementation |
| `implement-l` | Sol | Novel, cross-boundary, ambiguous, or high-risk implementation |

Only `orchestrate` may invoke subagents. Implementation agents cannot delegate. Native
`permission.task` allowlists enforce this directly.

Every task stores `implementation_tier` and `tier_rationale`. The selected agent fetches its
contract with `project_task_context`, reads repository instructions, and performs a pre-edit fit
check. An undersized assignment returns `TIER_MISMATCH` with concrete new risks. The orchestrator
then escalates upward in the same worktree. Tiers never downgrade, and partially completed work is
preserved when new risk appears.

## Lifecycle

```text
approved plan
    │
    ├─ preflight checks, one at a time
    │      └─ existing failure → explicit repair or exception choice
    │
    └─ milestone
           ├─ dispatch → implement → complete and merge
           ├─ dispatch → implement → complete and merge
           └─ gates, one at a time → verified
```

`project_dispatch` creates the worktree and returns the selected agent plus a compact task handle.
`project_complete_task` checks cleanliness and scope, runs all declared task evidence once for the
revision, and merges on success. There are no separate inspect, per-check verification,
task-done, merge, report, or trace steps.

Milestone gates run sequentially and stop at the first failure. The full output is preserved, the
failed gate remains priority, and a diagnostic agent identifies the root cause before one
`gate-repair` contract is created. That repair reuses one worktree until the failed gate passes
there diagnostically. After the cohesive repair merges, the integration revision runs the failed
gate first and then every remaining stale gate once. Verification requires every gate to pass at
the same revision.

## State and logs

Runtime data is repository-local and ignored without changing the repository root ignore file:

```text
.projects/
  .gitignore
  <project-id>/
    project.json
    logs/
      <attempt>.log
```

The manifest stores only approved contracts, state, material decisions, and compact evidence
attempt summaries. Each evidence attempt records revision, result, duration, exit code, stable
failure fingerprint, diagnostic tail, and its full ignored log path. Task checks default to five
minutes; preflight and milestone checks default to fifteen minutes and may declare up to thirty
minutes. There are no LLM step, token, reasoning, or variant budgets.

## Configuration

- Terra is the default model and Luna is the small model.
- Context compaction pruning is enabled.
- Automatic updates are disabled because the executable is managed externally.
- The optional remote source-control connector is disabled for project work.
- Permissions are deny-first with explicit grants per agent.
- Loop detection asks before continuing.
- Built-in general-purpose agents are disabled in favor of this explicit set.
- Restart OpenCode after configuration, agent, command, or tool changes.
