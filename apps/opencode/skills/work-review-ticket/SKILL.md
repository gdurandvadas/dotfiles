---
name: work-review-ticket
description: Validate a ClickUp ticket is ready for planning and implementation before work proceeds.
license: MIT
compatibility: opencode
metadata:
  role: workflow
  domain: project-management
  priority: high
---

# Ticket Readiness Review

**Provides:** Checklist for validating a ticket is ready to implement before planning or coding begins.

## Readiness Checklist

Review the ticket against each criterion. Surface gaps to the user before proceeding.

### Scope and Requirements

- [ ] Ticket has a clear, unambiguous title
- [ ] Acceptance criteria are defined and testable
- [ ] Scope is bounded — out-of-scope is noted or implied

### Context and Dependencies

- [ ] No blocking tickets or unresolved dependencies
- [ ] Relevant prior decisions or constraints are documented or inferable from the codebase
- [ ] Stated approach does not conflict with existing architecture

### Clarity

- [ ] Enough information to begin planning without further clarification
- [ ] Edge cases or known risks are noted

## Outcomes

**Ready:** All criteria met — proceed to planning and implementation.

**Not Ready:** One or more criteria missing — report gaps with specific questions. Do not proceed until resolved.

**Needs Clarification:** Ambiguous acceptance criteria — ask targeted questions (max 3) and wait for answers.

## Reporting Template

```
Ticket TASK-XXX is not ready to implement:

- Missing acceptance criteria — what does "done" look like?
- Dependency on TASK-YYY is unresolved — is that ticket complete?
- Approach mentions X but codebase uses Y — which should we follow?

Please clarify before we proceed.
```
