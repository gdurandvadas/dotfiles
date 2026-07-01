---
description: Continue in-flight work from a ClickUp task ID — restore branch, plan, and hand off to orchestrate
agent: work
---

Load the `work-ticket-workflow` skill immediately, then execute the **Work-Continue** checklist.

## Arguments

- Task ID: `$1` (custom ID like `DEV-123` or numeric ClickUp task ID)

If `$1` is empty, ask the user for the task ID and stop.

## Instructions

1. Load skill: `work-ticket-workflow`
2. Fetch ClickUp task `$1` via `clickup_get_task`
3. Read `.opencode/work/$1.json` if present
4. Find and checkout the work branch (prefer state, else search git branches for task ID)
5. `git pull --ff-only` when branch tracks remote
6. Load plan from state, `docs/plans/`, or ClickUp comments
7. Post resume comment to ClickUp with `[AI-generated — agent: work]` and current git status
8. Update session state `last_resumed_at`
9. Hand off to `@orchestrate` with task summary, plan path, completed plan tasks, and open items

Do not implement product code. Do not hand off without confirmed branch and plan path.
