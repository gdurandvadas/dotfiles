# Document-driven milestone orchestration

This OpenCode profile schedules work from immutable files. The filesystem is the source of truth;
conversation memory, todos, child-session state, and plugin memory are never workflow state.

## Durable contract

- `.opencode/plans/<milestone>.md` is a sealed execution contract created only by
  `workflow_contract` after deterministic DAG validation.
- `docs/decisions/<date>-<milestone>-wave-<n>.md` is a sealed checkpoint ADR created only by
  `workflow_checkpoint` after an audit.
- `workflow_status` recomputes progress from those files on every call. Never cache, mirror, or
  reproduce their state elsewhere.
- Never use shell, edit, write, patch, or generated scripts on `.opencode/plans/` or
  `docs/decisions/`. The workflow plugin rejects those mutations even if an agent asks.

## Roles

- `plan` researches the repository, defines stable task ids and dependencies, then submits the
  complete graph once through `workflow_contract`. It cannot edit application code.
- `orchestrator` is the only user-facing execution agent. It derives the next wave with
  `workflow_status`, dispatches every ready task concurrently, and stops after the checkpoint.
- `build-backend`, `build-frontend`, and `build-general` implement one bounded task. They may edit
  source and tests but cannot modify contracts, ADRs, or delegate.
- `pm-agent` audits a completed wave, runs the contract's validation, translates the outcome into
  product language, and submits exactly one ADR through `workflow_checkpoint`. It cannot edit
  source, plans, or ADRs directly.

## Wave protocol

1. Plan: research, model dependencies, and seal one contract.
2. Wave: dispatch all tasks in the first unaccepted wave in one parallel batch.
3. Checkpoint: wait for every worker, inspect the combined diff, validate, and have `pm-agent`
   create the ADR.
4. Review: present only the product impact, decisions, evidence, and ADR path. Stop for review.
5. Continue: the next `/milestone-run` recomputes readiness from disk and advances one wave.

Never skip a wave, accept partial work, infer success from a worker's prose, or begin a later wave
before the preceding ADR exists. A contract is create-once; changed scope requires a new milestone
slug and a new contract.
