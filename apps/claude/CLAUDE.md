# Work Claude Code

Use this environment for work development. Keep task-scale work coherent by treating every
design as a falsifiable hypothesis: name the state being replaced, the target state, intentional
compatibility, the removal inventory, and the authoritative quality gate.

## Flows

- **Standalone:** Make small, bounded changes directly. Investigate, implement, verify, and report
  evidence proportionate to risk.
- **Task:** Use `/task-new <description>` for cross-cutting work, refactors, or changes that need
  a durable audit trail. Then run `/design <id>` and `/task-run <id>`.

The task workflow is:

1. `/task-new` creates `docs/tasks/<id>/task.json` and its branch boundary.
2. `/design` writes the executable plan of record, sets the schema-v2 risk/scope/evidence contract,
   and advances the task to implementation.
3. `implement` edits sequentially, completes removals, records the task contract's evidence, and
   runs the authoritative completion gate.
4. `audit` proves target presence and former-state absence. It either returns work to implementation
   or writes `decisions.md` and closes the task.

`design.md` and `audit.md` are temporary. On a passing audit, only `task.json` and the compact,
decision-oriented `decisions.md` remain.

## Evidence

Never report only that tests pass. State the command, the property it exercised, and the result.
For replacement work, prove both that the target exists and that the replaced behavior is removed,
unreachable, or deliberately retained under a named compatibility contract.

## Boundaries

- Never read credentials or `.env` files.
- Never use destructive git operations, force-push, `rm`, or `sudo`.
- Keep internal URLs, credentials, and organization-specific configuration in environment variables
  or gitignored local configuration, never in this repository.
- Do not add Ayni to this work setup.
