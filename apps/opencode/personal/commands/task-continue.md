---
description: Continue an in-flight task — read manifest and report phase (handled by plugin)
agent: default
---

Handled deterministically by the task plugin. If you see this prompt, the plugin did not intercept the command.

Provide a task ID, e.g. `/task-continue 0007-auth-migration` or `/task-continue 0007`.

The plugin will:
1. Resolve the task folder
2. Read `task.json`
3. Report `current_phase`, `status`, doc presence, and suggested next agent

Do not spawn phase agents automatically. Invoke `@design`, `@run`, standalone `@implement`, or `@audit` when you are ready.
