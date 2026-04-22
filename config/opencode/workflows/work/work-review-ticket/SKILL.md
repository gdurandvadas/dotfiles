---
name: work-review-ticket
description: Load before planning or implementing any work ticket. Validates that the ticket is ready for implementation.
license: MIT
compatibility: opencode
metadata:
  role: workflow
  domain: project-management
  priority: high
---

# Ticket Readiness Review

**Provides:** A checklist for validating that a ticket is ready to implement before any planning or coding begins.

## Readiness Checklist

Review the ticket against each criterion. Surface any gaps to the user before proceeding.

### Scope & Requirements
- [ ] Ticket has a clear, unambiguous title
- [ ] Acceptance criteria are defined and testable
- [ ] Scope is bounded — what is explicitly out of scope is noted or implied

### Context & Dependencies
- [ ] No blocking tickets or unresolved dependencies
- [ ] Any relevant prior decisions or constraints are documented (or can be inferred from the codebase)
- [ ] The approach is not specified in a way that conflicts with existing architecture

### Clarity
- [ ] The ticket contains enough information to begin planning without further clarification
- [ ] Edge cases or known risks are noted

## Outcomes

**Ready**: All criteria met → proceed to planning and `work.architect` delegation.

**Not Ready**: One or more criteria missing → report the gaps to the user with specific questions. Do not proceed until resolved.

**Needs Clarification**: Ambiguity in acceptance criteria → ask targeted questions (max 3) and wait for answers.

## Template for Reporting Gaps

```
Ticket TASK-XXX is not ready to implement:

❌ Missing acceptance criteria — what does "done" look like?
❌ Dependency on TASK-YYY is unresolved — is that ticket complete?
⚠️  Approach mentions X but codebase uses Y — which should we follow?

Please clarify before we proceed.
```
