---
description: Continue an in-flight task — check out its branch and report phase (handled by plugin)
agent: default
---

Handled deterministically by the task plugin. If you see this prompt, the plugin did not intercept
the command.

Provide a task ID, e.g. `/task-continue 0007-auth-migration` or `/task-continue 0007`.

The plugin will:
1. Resolve the task folder
2. Check out the task's recorded branch (refuses if missing)
3. Read `task.json` and report phase, status, docs, and HEAD

Reply with only the plugin result above. Do not spawn phase agents automatically. Invoke `@design`,
`@run`, standalone `@implement`, or `@audit` when you are ready.
