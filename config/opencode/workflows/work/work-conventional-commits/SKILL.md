---
name: work-conventional-commits
description: Load when writing commit messages in work context. Enforces Conventional Commits format with mandatory ticket ID suffix for traceability.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: git
  priority: critical
---

# Conventional Commits (Work)

**Provides:** Commit message format with mandatory ticket ID for organizational traceability.

## Format

```
<type>(<scope>): <description> [TICKET-ID]

[optional body]

[optional footer(s)]
ai-generated: true
```

## Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `docs` | Documentation only |
| `chore` | Build, tooling, dependencies, config |
| `ci` | CI/CD pipeline changes |
| `style` | Formatting, whitespace (no logic change) |

## Rules

- **Ticket ID**: mandatory suffix in square brackets on the subject line — always the last thing
- **Subject line**: imperative mood, lowercase, no trailing period, ≤ 72 characters including the ticket suffix
- **Scope**: optional, lowercase, describes the module or area (e.g. `auth`, `api`, `db`)
- **Breaking changes**: add `!` after type/scope, or `BREAKING CHANGE:` footer
- **AI trailer**: every commit must include `ai-generated: true` as a git trailer in the footer
- **Body**: wrap at 72 chars; explain *what* and *why*, not *how*

## Examples

```
feat(auth): add OAuth2 login flow [TASK-123]

fix(api): handle null response from payment gateway [TASK-456]

refactor(db): extract query builder into separate module [TASK-789]

feat!: remove deprecated v1 endpoints [TASK-321]

BREAKING CHANGE: v1 API endpoints removed; migrate to v2
ai-generated: true
```

## Commit Command

```bash
git commit -m "feat(auth): add OAuth2 login flow [TASK-123]" \
           -m "" \
           -m "ai-generated: true"
```

## Anti-Patterns

- ❌ Missing ticket ID suffix
- ❌ Missing `ai-generated: true` trailer
- ❌ Vague messages: `fixed stuff`, `WIP`, `update`
- ❌ Starting with capital letter or ending with period
