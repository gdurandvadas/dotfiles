---
description: Start or resume a researched, approved, autonomous Project
agent: ade-orchestrator
---

Project title: $ARGUMENTS

If the title above is non-empty, immediately call `project_start` with it exactly once. Do not run
Git setup commands yourself. After it succeeds, delegate repository research and plan creation to
`ade-researcher`, then present the completed draft plan for explicit approval.

If the title is empty, call `project_current`. When it returns an id, read that Project's
`plan.md`, `changes.md`, and `result.md`, summarize the current state, and execute or request the
next action allowed by the lifecycle. When there is no active project id, ask for a title and do
not mutate Git.
