# OpenCode — Personal Profile

Personal OpenCode environment for everyday development and structured initiative work. Launched via `oc-pers` (symlinked from dotfiles to `~/.config/opencode-personal`).

Uses OpenAI (`gpt-5.5` primary, `gpt-5.4-mini` subagents). Default landing agent is `default`.

## Two Flows

| Flow | When | Entry | Docs |
|------|------|-------|------|
| **Standalone** | Small, bounded changes — bugfixes, single-file edits, quick refactors | `oc-pers` (lands on `@default`) | None |
| **Initiative** | Large changes, refactors, cross-cutting work needing memory and audit trail | `/initiative-start <description>` | `docs/initiatives/<id>/` |

The standalone flow is the default. The initiative flow is opt-in — use it when you need durable reasoning, human-in-the-loop decisions, and a record of what was actually built.

## Standalone Flow (`default`)

The `default` agent investigates and implements in one context. It may delegate to `@investigate` or `@code` if the task grows, but writes no initiative docs.

If scope turns out to be initiative-scale, it will suggest `/initiative-start`.

```bash
oc-pers                    # lands on @default
oc-pers --agent default    # explicit
```

## Initiative Flow

An **initiative** is a bounded unit of work with a distinct start and end, tracked by ID under `docs/initiatives/` in the **target project** (not in dotfiles).

### Commands

```bash
/initiative-start auth migration     # allocate ID, create folder, hand off to @research
/initiative-continue 0007              # resume by numeric prefix
/initiative-continue 0007-auth-migration
```

### On-Disk Layout

```
docs/initiatives/0007-auth-migration/
  initiative.json   # machine state — phase pointer, status, history
  research.md       # foundations, assumptions, decisions
  plan.md           # implementation plan
  audit.md          # reconciliation, blast radius
```

### initiative.json

JSON holds machine state agents read and update. Markdown holds human-readable reasoning.

```json
{
  "id": "0007-auth-migration",
  "title": "Auth Migration",
  "status": "active",
  "current_phase": "research",
  "created_at": "2026-07-07",
  "updated_at": "2026-07-07",
  "docs": {
    "research": "research.md",
    "plan": "plan.md",
    "audit": "audit.md"
  },
  "phase_log": [
    { "phase": "research", "at": "2026-07-07T09:00:00Z", "note": "initial scope" }
  ]
}
```

- `status`: `active` | `done`
- `current_phase`: `research` | `plan` | `implement` | `audit`
- `phase_log`: append-only — supports non-linear movement (e.g. `research → plan → research`)

IDs are `NNNN-<kebab-slug>` (4-digit zero-padded sequence + slug). The next ID is allocated by scanning `docs/initiatives/` for the highest existing number.

### Phases

Phases are **lenses over one shared folder**, not a rigid pipeline. Any phase can loop; movement is recorded in `phase_log`.

| Phase | Agent | Produces | Purpose |
|-------|-------|----------|---------|
| Research | `@research` | `research.md` | Investigate codebase + web, spar on options, record assumptions and decisions |
| Plan | `@plan` | `plan.md` | Turn research into ordered tasks; ask before assuming |
| Implement | `@orchestrate` | code changes (git) | Delegate atomic work to `@code`; bump `initiative.json` |
| Audit | `@audit` | `audit.md` | Reconcile plan vs reality; document blast radius; close initiative |

You can also invoke phase agents directly: `@research`, `@plan`, `@orchestrate`, `@audit`.

### What Each Doc Captures

| Question | Answered in |
|----------|-------------|
| Why did we make this assumption? | `research.md` → Assumptions & Decisions |
| Why did implementation deviate? | `audit.md` → Deviations & Rationale |
| What breaks if we change this? | `audit.md` → Blast Radius |

Future refactors should read prior initiative `research.md` and `audit.md` before touching code.

### Typical Paths

Linear:

```
/initiative-start → @research → @plan → @orchestrate → @audit → done
```

Non-linear (normal):

```
@research → @plan → @research (gap found) → @plan → @orchestrate → @audit
```

Resume anytime:

```
/initiative-continue 0007-auth-migration
```

## Agents

### Primary

| Agent | Role |
|-------|------|
| `default` | Standalone — investigate + implement, no docs |
| `initiative` | Bootstrap — allocate ID, create folder, route to phase agents |
| `research` | Investigation + web de-bias + assumptions/decisions |
| `plan` | Implementation planning, persisted to `plan.md` |
| `orchestrate` | Execution coordinator — delegates to `@code` |
| `audit` | Post-implementation reconciliation + blast radius |

### Subagents

| Agent | Role |
|-------|------|
| `investigate` | Read-only scoped research (codebase, web, MCP) |
| `code` | Atomic implementation tasks delegated by `@orchestrate` |

## Directory Structure

```
personal/
  README.md              # this file
  config.jsonc           # OpenAI provider, default_agent, permissions
  agents/
    primary/
      default.md
      initiative.md
      research.md
      plan.md
      orchestrate.md
      audit.md
    subagents/
      investigate.md
      code.md
  commands/
    initiative-start.md
    initiative-continue.md
  skills/                # (empty — add personal skills here)
```

## Configuration

- **Launch:** `oc-pers` sets `OPENCODE_CONFIG` and `OPENCODE_CONFIG_DIR` to this directory.
- **Default agent:** `default_agent: "default"` in `config.jsonc`.
- **External directories:** `~/Development/personal/**` and `~/Development/arai/**` are allowed.
- **Destructive commands:** `git reset`, `git clean`, `git push --force`, `rm`, `sudo` are denied globally.
