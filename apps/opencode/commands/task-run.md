---
description: Run the implement-to-audit loop until the task passes, needs design, or reaches its limit
agent: run
---

Task ID and optional iteration limit: {{arguments}}

Run the supervised implement-to-audit loop for this task. Call `task_status` first and follow the
task manifest after every delegated agent returns. If `@implement` returns still in `implement`
with actionable residual work, re-delegate it (up to three attempts per audit iteration) instead
of stopping or asking the user to run shell. Use `question` only when a human contract/design
decision is required.
