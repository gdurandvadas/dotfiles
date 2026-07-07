---
description: Continue an in-flight initiative — read manifest, report phase, route to the correct phase agent
agent: initiative
---

Execute the **Initiative-Continue** flow.

## Arguments

- Initiative ID: `$1` (e.g. `0007-auth-migration` or `0007`)

If `$1` is empty, ask the user for the initiative ID and stop.

## Instructions

1. Resolve the initiative folder: if `$1` is numeric only, glob `docs/initiatives/$1-*`; if ambiguous, ask the user
2. Read `docs/initiatives/<id>/initiative.json`
3. Report `current_phase`, `status`, and the last 3 `phase_log` entries
4. Route to the phase agent matching `current_phase` (research, plan, orchestrate, or audit)
5. If `status` is `done`, report completion instead of routing

Do not implement product code. Do not hand off without a confirmed initiative path.
