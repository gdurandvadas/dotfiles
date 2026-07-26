# OpenCode Personal Profile

Personal OpenCode configuration for standalone changes and autonomous milestone projects. Launch it
with `oc-pers`; configuration files are linked out of store and loaded from this directory.

## Flows

| Flow | Entry | Use |
|---|---|---|
| Standalone | `@default` | Small, bounded changes completed in one context |
| Project | `/project <name-or-id>` | Large changes delivered as verified milestones and small tasks |

`/project` is the only project command. A new name creates a project; an ID or numeric prefix
resumes one; no argument lists local projects.

```text
/project improve-the-engine-ui
/project 0003
/project 0003-improve-the-engine-ui
```

Project state uses schema version 3. Earlier project schemas are intentionally unsupported rather
than carrying their lifecycle assumptions forward.

## Delivery model

```text
project
├── milestone
│   ├── task
│   ├── task
│   └── integration gates
├── milestone
│   ├── task
│   └── integration gates
└── close
```

A **task** is one small implementation unit, one worktree, and one cohesive merge. Task evidence is
focused and cheap. A **milestone** is a meaningful integrated outcome. Its gates run once, after all
of its tasks have merged, and are the authoritative proof for the broader behavior and quality
contract.

Verification-only tasks and final-audit worktrees do not exist. A milestone gate runs directly on
the integration branch and never needs a branch, merge, adoption, or no-op commit.

The orchestrator continuously advances the state machine:

```text
ready task → running → verified → merged
                                   │
                 all tasks merged ┘
                                   ↓
                    milestone verifying → verified
                                             │
                                  next milestone or close
```

It does not stop for confirmation between tasks or milestones. It asks the user only when a choice
materially changes behavior, scope, architecture, external systems, or would discard work.

## Agents

```text
orchestrate
├── investigate × N
└── implement
    ├── investigate (only when needed)
    └── code × N (only for necessary disjoint slices)
```

| Agent | Responsibility |
|---|---|
| `default` | Standalone investigation and implementation |
| `orchestrate` | Plans milestones, owns project state, schedules continuously, verifies, merges, and closes |
| `implement` | Completes one small task directly and creates cohesive commits |
| `investigate` | Answers one bounded read-only evidence question |
| `code` | Handles an exceptional atomic code slice; never commits or changes project state |

Nested agents are optional work-sharing tools, not mandatory ceremony. The implementation agent
normally performs its task directly. Native OpenCode `task` sessions retain their parent IDs, and
the telemetry plugin records lineage without replacing the native UI.

## Lightweight recovery

Routine failures remain ordinary state transitions:

- dispatch skips stale branch/worktree attempts automatically;
- evidence commands and timeouts can be corrected in place;
- clean unintegrated work can be requeued onto the next attempt;
- an incomplete unmerged task contract can be updated without a separate reconciliation phase;
- a milestone failure creates a bounded repair task in that milestone;
- Git errors preserve their original diagnostic;
- automated commits explicitly disable interactive signing.

An identical failed command is never repeated without changing code or correcting its contract.
There is no reconciliation agent or reconciliation lifecycle.

## Compact local state

Runtime data is repository-local and ignored without modifying the root `.gitignore`:

```text
.projects/
  .gitignore
  <project-id>/
    project.json
    metrics.jsonl
```

`project.json` contains milestones, tasks, evidence, and material decisions. `project_status` returns
only milestone counts, ready/active task contracts, and the next action. Full milestone or task
detail is fetched explicitly with `project_inspect`; mutation tools also return compact state.

Evidence commands are executable-plus-argument arrays and run without a shell. Task commands
default to five minutes. Milestone gates default to fifteen minutes and may declare up to thirty
minutes.

`metrics.jsonl` records trace lineage plus project lifecycle operations, delegated tasks,
implementation commands, user questions, and failures. High-volume read/glob activity and repeated
session-status events are intentionally omitted. Telemetry is append-only observability data, not
part of lifecycle state.

## Branches

- integration: `project/<project-id>`
- task: `work/<project-id>-<task-id>-<attempt>`

Attempts increase monotonically and dispatch skips any stale branch or worktree collision.
Automated task and merge commits use `commit.gpgsign=false` so GUI signing prompts cannot stall the
project.

## Configuration

- `default_agent: "default"` remains the ordinary entry point.
- OpenCode's built-in plan agent is disabled.
- Destructive Git commands, force pushes, `rm`, and `sudo` are denied.
- Restart OpenCode after editing agents, commands, tools, plugins, or `config.jsonc`; configuration
  is loaded only at startup.
