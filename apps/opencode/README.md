# OpenCode v2 Personal ADE

This directory is the configuration loaded by `oc`. Home Manager links it to
`~/.config/opencode-personal`, while Mise installs the pinned `opencode2` beta.

## Workflow

Start autonomous delivery from a Git repository:

```text
/project Add account recovery
```

The command:

1. preserves current staged, unstaged, and untracked work;
2. switches to and fast-forwards `origin`'s default branch;
3. creates a unique `project/<id>` branch;
4. scaffolds committed living documents under `.projects/<id>/`;
5. researches and presents a plan for explicit approval;
6. delegates approved tasks to the S, M, or L developer;
7. validates and commits once per milestone;
8. pushes and creates a draft PR after final validation.

Run `/project` without a title on an existing `project/*` branch to resume it.

## Durable state

There is no project database or JSON state machine. These documents are the contract:

- `plan.md` — objective, research, architecture, milestones, tasks, tiers, and validation.
- `changes.md` — append-only validation and change evidence per milestone.
- `result.md` — cumulative acceptance, final behavior, impact, debt, and publication.

The plugin in `plugins/project.ts` owns only operations that must be deterministic: branch setup,
approval metadata, explicit-path milestone commits, and draft-PR publication.

## Agents

| Agent | Model | Purpose |
| --- | --- | --- |
| `ade-orchestrator` | Sol, medium reasoning | User interface and lifecycle owner |
| `ade-researcher` | Sol, high reasoning | Isolated research and planning |
| `ade-developer-s` | Luna, no reasoning | Exact demonstrated changes |
| `ade-developer-m` | Terra, low reasoning | Bounded component work |
| `ade-developer-l` | Sol, medium reasoning | Architectural or high-risk work |
| `ade-archivist` | Luna, no reasoning | Precise living-document updates |

Temperature and reasoning effort are encoded in model variants because OpenCode v2 does not yet
apply per-agent request overlays.

## Validation

When a repository has `.ayni.toml` and `ayni` is available, milestones run
`ayni analyze --output json` in addition to their repository-native promotion commands. The ADE
never installs Ayni. If it is unavailable, the approved native commands remain the gate and the
living documentation records that Ayni was skipped.

## Development

```sh
cd apps/opencode
bun install --frozen-lockfile
bun test
bun run typecheck
```

The OpenCode v2 CLI and `@opencode-ai/plugin` must stay on the same exact beta version.
