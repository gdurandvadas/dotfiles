---
description: Start a new task — allocate ID, create docs/tasks folder (handled by plugin)
agent: default
---

Handled deterministically by the task plugin. If you see this prompt, the plugin did not intercept the command.

Provide a short description after the command, e.g. `/task-start auth migration`.

The plugin will:
1. Allocate the next task ID
2. Create `docs/tasks/<id>/` and write `task.json`
3. Report the created path and suggest `@design` when you are ready

Do not investigate or spawn phase agents automatically.
