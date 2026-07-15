---
description: Design a task-scale state transition and advance it to implementation when complete.
---

Design task `$ARGUMENTS`.

Call `mcp__task__status` first, then read the existing `docs/tasks/<id>/design.md` if present.
On first invocation, greet the user with the task ID/title/phase, ask what they want designed and
their success criteria or constraints, then stop. Do not investigate the codebase until directed.

When directed, investigate only the facts required to establish:

- Current state, target state, why, and deliberate compatibility.
- Complete removal inventory: code, config, tests, dependencies, routes, runtime topology, and docs.
- Consequential decisions, required-now versus deferred scope, and risks.
- An authoritative quality gate plus behavior-specific evidence.

Write `docs/tasks/<id>/design.md` with these exact headings:

```markdown
# Design — <Title>
## Goal
## Current State
## State Transition
## Removal Inventory
## Decisions
## Required Now / Deferred
## Authoritative Gate
## Implementation Tasks
## Risks and Open Questions
```

The design is a falsifiable plan of record, not a list of files. When complete, call
`mcp__task__advance` with phase `implement` and hand off to `/task-run <id>`.
