---
name: conventional-commits
description: Load when writing commit messages. Enforces Conventional Commits format for clean, readable git history.
license: MIT
compatibility: opencode
metadata:
  role: standards
  domain: git
  priority: high
---

# Conventional Commits

**Provides:** Commit message format rules for consistent, machine-readable git history.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
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

- **Subject line**: imperative mood, lowercase, no trailing period, ≤ 72 characters
- **Scope**: optional, lowercase, describes the module or area (e.g. `auth`, `api`, `db`)
- **Breaking changes**: add `!` after type/scope, or `BREAKING CHANGE:` footer
- **Body**: wrap at 72 chars; explain *what* and *why*, not *how*

## Examples

```
feat(auth): add OAuth2 login flow

fix(api): handle null response from payment gateway

refactor(db): extract query builder into separate module

chore: upgrade dependencies to latest patch versions

feat!: remove deprecated v1 endpoints

BREAKING CHANGE: v1 API endpoints removed; migrate to v2
```

## Anti-Patterns

- ❌ `fixed stuff`
- ❌ `WIP`
- ❌ `update`
- ❌ Starting with capital letter or ending with period
- ❌ Vague scope-less messages for meaningful changes
