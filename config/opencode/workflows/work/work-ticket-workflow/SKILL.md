---
name: work-ticket-workflow
description: Load at the start of every work orchestration session. Enforces the ticket-first implementation protocol with mandatory checklist.
license: MIT
compatibility: opencode
metadata:
  role: workflow
  domain: project-management
  priority: critical
---

# Ticket-First Workflow

**Provides:** Step-by-step implementation protocol ensuring all work is grounded in a ticket, researched before implementation, and properly attributed.

## Implementation Checklist

Work through these steps in order. Do not skip any step.

### Pre-Implementation
- [ ] **1. Confirm ticket** — get or confirm the ticket ID from the user
- [ ] **2. Review readiness** — load `work-review-ticket` and validate the ticket is ready to implement
- [ ] **3. Research** — delegate to `work.architect` for technical analysis and implementation plan
- [ ] **4. Post plan** — post the architect's plan as a comment on the ClickUp ticket

### Implementation
- [ ] **5. Create branch** — create a working branch named `<type>/<ticket-id>-<short-description>` (e.g. `feat/TASK-123-oauth-login`)
- [ ] **6. Implement** — delegate to the appropriate implementation agent with the architect's plan and ticket ID
- [ ] **7. Pre-commit review** — before committing, verify the diff is clean, minimal, and matches acceptance criteria
- [ ] **8. Commit** — load `work-conventional-commits` and `work-ai-attribution`; commit with ticket ID suffix and `ai-generated: true` trailer
- [ ] **9. Push and PR** — push the branch; create a PR with AI attribution labels and notice footer

### Post-Implementation
- [ ] **10. Update ticket** — transition ticket status to Done (or In Review if PR review is required)
- [ ] **11. Reflect** — load `reflect-and-improve`; capture learnings or create follow-up tickets

## Branch Naming

```
<type>/<ticket-id>-<short-kebab-description>

# Examples:
feat/TASK-123-oauth-login
fix/TASK-456-null-payment-response
refactor/TASK-789-db-query-builder
```

## When to Pause and Surface to User

- Ticket is not ready (missing acceptance criteria, blocked)
- Architect plan reveals unexpected complexity or risk
- Implementation fails twice on the same task
- Any security-sensitive change without appropriate skills loaded

## Constraints

- Never implement without a confirmed ticket
- Never skip the architect research phase
- Never commit without the `ai-generated: true` trailer
- Never close a ticket without verifying acceptance criteria are met
