---
description: Execute the next ready wave and stop after its audited ADR
agent: orchestrator
---

Advance milestone `$ARGUMENTS` by exactly one Wave → Checkpoint cycle.

Call `workflow_status` first (use the newest milestone when no slug is supplied), read the sealed
contract, dispatch all tasks in the ready wave concurrently to their declared build agents, inspect
and reconcile their combined work, then delegate the audit to `pm-agent`. Stop after the ADR is
created and present its product outcome, decisions, validation evidence, follow-ups, and path.
