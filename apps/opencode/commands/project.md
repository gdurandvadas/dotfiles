---
description: Design, execute, validate, or resume a schema-v5 Project
agent: project
---

Project name or ID: $ARGUMENTS

When the argument is empty and the checked-out branch is `project/<id>`, use `project_open` to
resolve and resume that ID. Otherwise list schema-v5 projects when empty, resume when the argument
resolves, or create a design record for a new name. Schema-v4 records are read-only history.

For a new Project, treat the name only as a label. If the conversation does not already contain a
substantive request, immediately ask what the user wants to achieve; do not inspect or research
the repository from the title. If substantive context already exists, use it and ask only for
material missing behavior or constraints. Research begins only after the Objective and observable
success criteria are known.

Present one concise plan with milestones, ordered S/M/L tasks, dependencies, expected
responsibility surfaces, focused checks, and exact repository-declared milestone commands. After
research, store the first draft with `approved: false`; that checks out its visible Project branch.
Present it for approval, then store the approved revision with `approved: true` and continue
autonomously through foreground, sequential implementation, scope review, validation, recovery,
and draft-PR publication. Reclaim a running task after session interruption. Task adaptations
inside the current milestone need no approval; a new or materially changed milestone does.
