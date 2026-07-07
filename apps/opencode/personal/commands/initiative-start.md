---
description: Start a new initiative — allocate ID, create docs/initiatives folder, hand off to research
agent: initiative
---

Execute the **Initiative-Start** flow.

## Arguments

- Description: `$ARGUMENTS` (used to derive the initiative title and slug)

If `$ARGUMENTS` is empty, ask the user for a short description of the initiative and stop.

## Instructions

1. Derive a kebab-case slug from the description
2. Allocate the next initiative ID by scanning `docs/initiatives/` for the highest `NNNN` prefix
3. Create `docs/initiatives/<id>/` and write `initiative.json` (`status: active`, `current_phase: research`)
4. Hand off to `@research` with the initiative path, ID, and title

Do not implement product code. Do not write research content yourself. Do not hand off without a confirmed initiative ID and folder.
