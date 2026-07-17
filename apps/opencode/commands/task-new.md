---
description: Create a new task — allocate ID, create branch, docs/tasks folder (handled by plugin)
agent: default
model: openai/gpt-5.6-terra
---

Handled deterministically by the task plugin. If you see this prompt, the plugin did not intercept
the command.

Required usage:

```text
/task-new <description> --change-type=<feat|fix|doc|chore|refactor|perf>
/task-new --name="<description>" --change-type=feat --new-branch=true
/task-new auth migration --change-type=feat --new-branch=false
```

`--change-type` is required. `--new-branch` defaults to `true` (create from the default branch).
Use `--new-branch=false` to check out an existing `<type>/<id>-…` branch.

Reply with only the plugin result above. Do not ask questions, call tools, investigate, design,
edit source, run git, or call `task_create`.
