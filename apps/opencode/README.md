# OpenCode Personal Profile

Personal OpenCode configuration for standalone changes and orchestrated projects. Launch it with
`oc-pers`; configuration files are linked out of store and loaded from this directory.

## Flows

| Flow | Entry | Use |
|---|---|---|
| Standalone | `@default` | Small, bounded changes completed in one context |
| Project | `/project <name-or-id>` | Multi-package work needing explicit state, delegation, recovery, and traceability |

`/project` is the only project command. A new name creates a project; an ID or numeric prefix
resumes one; no argument lists local projects.

```text
/project improve-the-engine-ui
/project 0002
/project 0002-improve-the-engine-ui
```

Projects do not declare a change type up front. Their integration branch is
`project/<project-id>`. Each implementation package chooses its Conventional Commit type from the
actual change and runs in `work/<project-id>-<node-id>-<attempt>`.

## Agents

```text
orchestrate
├── design
│   └── investigate × N
├── implement
│   ├── investigate × N
│   └── code × N (disjoint writable scopes only)
└── reconcile
    ├── design
    └── implement
```

| Agent | Responsibility |
|---|---|
| `default` | Standalone investigation and implementation |
| `orchestrate` | Sole project-state owner; schedules, verifies, merges, reconciles, and closes |
| `design` | Plans task graphs and coordinates parallel read-only research |
| `implement` | Coordinates one approved package, evidence, and cohesive commits |
| `reconcile` | Resolves unforeseen scope, repository, or lifecycle divergence through sequential design and implementation |
| `investigate` | One atomic read-only evidence request |
| `code` | One bounded code change; never commits or changes project state |

For a node, design and implementation are sequential. Parallelism exists only among independent
investigations, disjoint code slices, or dependency-ready packages with non-overlapping writes.
Nested orchestration uses the local `delegate` tool, which enforces the call graph and launches a
batch of child OpenCode sessions in parallel. This keeps the workflow functional on stable OpenCode
versions that do not yet expose native nested-subagent depth configuration.

## Local State

Project runtime data is repository-local and ignored without modifying the repository's root
`.gitignore`:

```text
.projects/
  .gitignore              # ** plus !.gitignore
  <project-id>/
    project.json          # authoritative state machine
    metrics.jsonl         # append-only agent/tool trace
```

`project.json` contains the package graph, lifecycle state, evidence, decisions, and reconciliation
records. It contains no derived telemetry aggregates. Normal node states are
`ready → running → verified → merged`; exceptions use `reconciling` or `blocked`.
Evidence commands are stored as executable-plus-argument arrays and run without a shell, with a
bounded timeout and a clean-worktree requirement.

`metrics.jsonl` records `trace_id`, `span_id`, `parent_span_id`, agent, origin, stage, node, event,
outcome, duration, and revision where available. Child agents receive their parent's trace lineage,
so a tool event can be attributed to the originating `design`, `implement`, or `reconcile` flow and
its position in orchestration.

## Reconciliation

The orchestrator invokes `reconcile` when reality diverges from the approved graph. Guarded
recovery operations are:

- requeue unintegrated package state;
- adopt already-integrated work after validating ancestry, scope, and fresh evidence;
- add unforeseen work or replace one unmerged contract;
- block when no truthful automated transition exists.

Merged history is immutable. Technical debt is represented as explicit added work or a durable
reconciliation decision, never as silent plan rewriting.

## Configuration

- `default_agent: "default"` remains the ordinary entry point.
- OpenCode's built-in `plan` agent is disabled.
- Destructive Git commands, force pushes, `rm`, and `sudo` are denied.
- Restart OpenCode after editing agents, commands, tools, plugins, or `config.jsonc`; configuration
  is loaded only at startup.
