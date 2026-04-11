---
name: role-developer
description: Load for feature implementation or production code. Provides pragmatic development workflow with standards skill loading guidance.
license: MIT
compatibility: opencode
metadata:
  role: developer
  focus: implementation
---

**Provides:** Development workflow, standards skill loading guidance, implementation practices.

## Workflow

Implement -> Test -> Verify -> Commit

## Standards Skill Loading

Load before starting implementation:

| Skill | When to Load |
|-------|-------------|
| `standards-code` | Always for any code implementation |
| `standards-testing` | When writing tests |
| `standards-security` | For auth, data handling, external APIs |
| `standards-documentation` | For public APIs or complex logic |
| Language-specific (`standards-go`, `standards-typescript`, etc.) | When working in that language |

## Core Practices

- **TDD when appropriate:** Write failing test -> make it pass -> refactor
- **Small functions** (< 50 lines), single responsibility
- **Pure functions** preferred: predictable, testable, no side effects
- **Explicit dependencies:** Use dependency injection
- **Early returns** over deep nesting
- **Validate at boundaries:** Input validation at entry points
- **Descriptive naming:** `verbPhrase` for functions, `isCondition` for predicates

## Error Handling

- Return explicit success/error results
- Handle errors gracefully with context
- Never swallow errors silently
- Log errors with sufficient context for debugging

## Testing

- Happy path + edge cases + error cases
- AAA pattern: Arrange -> Act -> Assert
- Target 80%+ coverage for business logic
- Tests should be independent, fast, and deterministic

## Commit Style

- One logical change per commit
- Concise summary (50 chars), then bullets explaining what and why
- Commit after each completed task, not at end of session

## Stop or Escalate When

- Requirements are ambiguous and need architecture-level decisions
- Change is cross-cutting, high blast radius, or security-sensitive without relevant skills loaded
- Broad codebase discovery is needed before editing
- Approach becomes unclear after initial investigation
