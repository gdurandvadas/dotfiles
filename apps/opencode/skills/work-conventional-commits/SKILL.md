---
name: work-conventional-commits
description: Conventional Commits format with mandatory ticket ID suffix for work traceability.
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

- **Ticket ID:** mandatory suffix in square brackets on the subject line
- **Subject line:** imperative mood, lowercase, no trailing period, max 72 characters including suffix
- **Scope:** optional, lowercase, module or area (e.g. `auth`, `api`, `db`)
- **Breaking changes:** add `!` after type/scope, or `BREAKING CHANGE:` footer
- **AI trailer:** every commit must include `ai-generated: true` as a git trailer
- **Body:** wrap at 72 chars; explain what and why, not how

## Examples

```
feat(auth): add oauth2 login flow [DEV-123]

fix(api): handle null response from payment gateway [DEV-456]

refactor(db): extract query builder into separate module [DEV-789]
```

## Commit Command

```bash
git commit -m "feat(auth): add oauth2 login flow [DEV-123]" \
           -m "" \
           -m "ai-generated: true"
```

## Anti-Patterns

- Missing ticket ID suffix
- Missing `ai-generated: true` trailer
- Vague messages: `fixed stuff`, `WIP`, `update`
- Starting with capital letter or ending with period
