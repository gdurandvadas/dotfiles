---
description: Supervise the bounded implement-to-audit loop for one task.
---

Run the task loop for `$ARGUMENTS`. Parse an optional `max=<1-5>`; default to 3 and never exceed 5.

1. Call `mcp__task__status`.
2. If done, report its `decisions.md`. If in design, stop and direct the user to `/design <id>`.
3. If in implement, delegate a self-contained prompt to the `implement` agent. It must call status,
   read the design, execute only the design/removal inventory, run the gate, and advance to audit
   only when coherent.
4. Call status. If phase is audit, delegate a self-contained pass/fail prompt to `audit`.
5. Call status after audit. Stop on done or design. Continue only when audit returned the task to
   implement, until the iteration limit.

After each iteration report phase, audit result, evidence, blockers, and why the loop stopped.
Never implement, audit, or redesign directly.
