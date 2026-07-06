---
description: Start new ticket-first work — create ClickUp task, plan, branch, hand off to orchestrate
agent: work
---

Load the `work-ticket-workflow` skill immediately, then execute the **Work-Start** checklist.

## Arguments

- Type: `$1` (conventional commit type: feat, fix, refactor, chore, docs, ci, test, perf, style)
- Description: `$2` and rest of `$ARGUMENTS`

## Instructions

1. Load skills: `work-ticket-workflow`, `work-review-ticket`, `work-ai-attribution`
2. Create a ClickUp task in the DevEx space (env `CLICKUP_DEVEX_SPACE`, default `devex`) using list from `CLICKUP_DEVEX_LIST` or ask the user
3. Task name: derive from `$ARGUMENTS`; type is `$1`
4. Run readiness review before planning
5. Delegate to `@plan` to produce a plan in the chat unless a plan already exists
6. Post plan summary to ClickUp with `[AI-generated — agent: work]` prefix
7. Git bootstrap on default branch, then create branch: `$1/<task-id>-<slug>`
8. Write `.opencode/work/<task-id>.json`
9. Hand off to `@orchestrate` with task ID, branch, and remaining plan tasks

Do not implement product code. Do not hand off without confirmed task ID and branch.
