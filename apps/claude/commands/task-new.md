---
description: Create a task, choose its branch boundary, and record its manifest.
---

Create a task for: $ARGUMENTS

1. Call `mcp__task__create` with the supplied description. Do not investigate or edit source.
2. Use `AskUserQuestion` once to ask:
   - Is this a new branch? (New branch / Existing branch)
   - What type of change is this? (feat / fix / doc / chore / refactor / perf)
3. Call `mcp__task__set_branch` with the returned task ID, chosen change type, and branch choice.
4. Report the task ID, branch result, its path, commit format, and that `/design <id>` is next.

Do not start design or spawn agents automatically.
