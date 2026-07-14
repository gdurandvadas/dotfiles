---
description: Create a new task — allocate ID, branch setup, docs/tasks folder (handled by plugin)
agent: default
model: openai/gpt-5.6-terra
---

The task plugin has already created the task above. Do only what follows.

If the output contains `Branch prompt: <task-id>`:

1. Call the **question** tool once with **two** questions (in order):
   - **header:** Branch
     **question:** Is this a new branch?
     **options:** New branch / Existing branch (single select, no custom answer)
   - **header:** Type
     **question:** What type of change is this?
     **options:** feat / fix / doc / chore / refactor / perf (single select, no custom answer)
2. After the user answers, report the resulting branch (`<type>/<task-id>`) in one short line.
3. Do not investigate, design, edit source, run git commands, or call `task_create`.

The plugin records the branch and runs git after the user answers:
- **New branch:** switch to the default branch, then create `<type>/<task-id>` from it
- **Existing branch:** checkout `<type>/<task-id>` if it already exists

Do not investigate or spawn phase agents automatically.
