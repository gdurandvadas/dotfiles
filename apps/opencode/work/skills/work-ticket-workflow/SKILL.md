---
name: work-ticket-workflow
description: Ticket-first work protocol for work-start and work-continue. ClickUp task, plan, branch, session state, and orchestrate handoff.
license: MIT
compatibility: opencode
metadata:
  role: workflow
  domain: project-management
  priority: critical
---

# Ticket-First Workflow

**Provides:** Step-by-step protocol for starting and continuing work grounded in a ClickUp task ID, with git branch conventions and session state for cross-session resume.

## Environment Defaults

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLICKUP_DEVEX_SPACE` | Space name to search | `devex` |
| `CLICKUP_DEVEX_LIST` | Default list for new tasks | ask user if unset |
| `CLICKUP_MCP_URL` | ClickUp MCP endpoint | required |
| `CLICKUP_MCP_TOKEN` | ClickUp MCP auth token | required |

## Branch Naming

```
<type>/<task-id>-<short-kebab-description>
```

Examples: `feat/DEV-123-oauth-login`, `fix/DEV-456-null-payment-response`

- `<type>`: conventional commit type (`feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `test`, `perf`, `style`)
- `<task-id>`: ClickUp `custom_id` (preferred) or numeric `task_id`
- Slug: lowercase kebab-case, max 40 chars, from task title or description args

## Session State

Write to `.opencode/work/<task-id>.json` in the **project repo** (not dotfiles):

```json
{
  "task_id": "DEV-123",
  "task_url": "https://app.clickup.com/t/...",
  "branch": "feat/DEV-123-oauth-login",
  "plan_path": "docs/plans/oauth-login.md",
  "type": "feat",
  "started_at": "2026-06-30T12:00:00Z",
  "last_resumed_at": "2026-06-30T14:00:00Z",
  "completed_plan_tasks": [1, 2]
}
```

- Create on `work-start`; update `last_resumed_at` on `work-continue`
- `@orchestrate` updates `completed_plan_tasks` after each plan task
- If missing on continue, recover from ClickUp + git branch search
- Repos should gitignore `.opencode/work/` (local session metadata)

## Work-Start Checklist

Do not skip steps. Do not hand off to `@orchestrate` until all gates pass.

### Pre-Implementation

- [ ] **1. Load skills** — `work-review-ticket`, `work-ai-attribution`
- [ ] **2. Resolve list** — find space `$CLICKUP_DEVEX_SPACE` (default `devex`), resolve list via `clickup_get_workspace_hierarchy` / `clickup_get_list`; use `CLICKUP_DEVEX_LIST` or ask user
- [ ] **3. Create task** — `clickup_create_task` with name from `$ARGUMENTS`, markdown description stub (goal, acceptance criteria, out-of-scope)
- [ ] **4. Capture ID** — prefer `custom_id`, fallback to `task_id`
- [ ] **5. Review readiness** — run `work-review-ticket` checklist; pause if not ready
- [ ] **6. Plan** — delegate to `@plan` with task context, or confirm plan already exists at `docs/plans/<topic>.md`
- [ ] **7. Post plan** — `clickup_create_comment` with `[AI-generated — agent: work]` prefix and plan summary

### Git Bootstrap

- [ ] **8. Clean tree** — `git status`; stop if dirty unless user confirms
- [ ] **9. Default branch** — detect via `git symbolic-ref refs/remotes/origin/HEAD` or `main`/`master`
- [ ] **10. Update base** — `git switch <default> && git pull --ff-only`
- [ ] **11. Create branch** — `git switch -c <type>/<task-id>-<slug>`
- [ ] **12. Write state** — create `.opencode/work/<task-id>.json`

### Handoff

- [ ] **13. Hand off** — invoke `@orchestrate` with task ID, branch, plan path, ClickUp URL, remaining plan tasks

## Work-Continue Checklist

- [ ] **1. Fetch task** — `clickup_get_task` for `$1` (supports custom IDs like `DEV-123`); include description; use `clickup_get_task_comments` if needed
- [ ] **2. Load state** — read `.opencode/work/<task-id>.json` if present
- [ ] **3. Find branch** — prefer `state.branch`; else `git branch -a` filtered by task ID; ask if multiple matches
- [ ] **4. Checkout** — `git switch <branch> && git pull --ff-only` (when tracking remote)
- [ ] **5. Load plan** — prefer `state.plan_path`; else glob `docs/plans/`; else latest plan comment on ClickUp task
- [ ] **6. Resume comment** — post to ClickUp with git status summary and `[AI-generated — agent: work]`
- [ ] **7. Update state** — set `last_resumed_at`; preserve `completed_plan_tasks`
- [ ] **8. Hand off** — invoke `@orchestrate` with task summary, plan path, completed tasks, open plan items

## Post-Implementation (orchestrate / code)

- [ ] Pre-commit review — diff is clean, minimal, matches acceptance criteria
- [ ] Commit — load `work-conventional-commits` and `work-ai-attribution`
- [ ] Push and PR — AI attribution labels and notice footer
- [ ] Update ClickUp status — Done or In Review
- [ ] Update session state `completed_plan_tasks`

## When to Pause

- Ticket not ready (missing acceptance criteria, blocked)
- Plan reveals unexpected complexity or risk
- Implementation fails twice on the same task
- Security-sensitive change without appropriate skills loaded
- Dirty git tree without user confirmation
- Branch not found and user declines creation

## Constraints

- Never implement product code — bootstrap and hand off only
- Never skip ClickUp task ID confirmation
- Never hand off without branch and plan path
- Never commit without ticket ID suffix and `ai-generated: true` trailer
