---
description: Create, approve, execute, or resume a schema-v4 project
agent: orchestrate
---

Project name or ID: $ARGUMENTS

Create a project when this is a new name, resume it when it resolves to a schema-v4 ID or numeric
prefix, and list current schema-v4 projects when it is empty. Earlier schemas are intentionally
ignored.

A new name is only a label. Immediately after creation, ask the user what they have in mind. Do
not inspect the repository, invoke research, or infer requirements from the name before the user
has described the work. Ask concise follow-up questions until the outcome, scope, exclusions,
constraints, and success conditions are understood.

Only then read repository policy and present a complete plan—including preflight, task and
milestone evidence plus an implementation tier and rationale for every task—for explicit user
approval. Once approved, continue through dispatch, implementation, completion, and sequential
gates until the project finishes or a material user decision is required. Keep the user informed
between tool calls: announce each phase, identify the running check and its purpose, summarize
meaningful live output and elapsed time while polling, and report passes, failures, merges, and
the next action as they happen.
