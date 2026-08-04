---
description: Audit the current wave and create its checkpoint ADR
agent: orchestrator
---

Resume the checkpoint boundary for milestone `$ARGUMENTS` without starting new implementation.
Call `workflow_status`, inspect the current ready wave and working diff, collect the task validation
requirements, and delegate the complete audit to `pm-agent`. If evidence is incomplete, report what
must be corrected. If accepted, present only the product-facing ADR summary and its path.
