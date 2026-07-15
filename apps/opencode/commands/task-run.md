---
description: Run the implement-to-audit loop until the task passes, needs design, or reaches its limit
agent: run
---

Task ID and optional iteration limit: {{arguments}}

Run the supervised implement-to-audit loop for this task. Call `task_status` first and follow the
task manifest after every delegated agent returns.
