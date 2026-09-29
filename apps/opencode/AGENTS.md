# Managed-agent runtime

This OpenCode profile separates durable reasoning state from execution. OpenCode sessions are the
source of truth; hands are logical tool interfaces that execute directly in OpenCode's environment.

## Contracts

- **Brains:** `managed` is the execution primary brain; `managed-plan` is a read-only planning
  primary brain. `managed` may create `managed-worker` and `managed-reviewer` child sessions with
  `brain_spawn`. Brain-local memory is never durable state.
- **Hands:** every repository read, search, edit, and command uses `hand_*`. Native host tools are
  denied so orchestration stays explicit. Hands require no provisioning or lifecycle management.
  Commands are cancellable, default to a 15-minute deadline, and return a bounded head and tail;
  searches and recursive listings skip generated dependency trees unless explicitly requested.
- **Session:** OpenCode persists messages and tool results. `session_events` reads positional
  slices without changing history and offers a server-limited `tail` for efficient recovery;
  `session_note` records explicit recovery state.

Resume a durable brain with `oc --session <session-id>`. Use `session_events` only when the active
context does not contain the exact historical detail needed.

Select an execution ceiling at launch with `oc --budget small|standard|long`. Project
`opencode.jsonc` agent overrides are honored; the launcher flag wins for that process. A running
process cannot change its own hard step ceiling, so resume the session under another budget when
necessary.

Use `/shape <request>` when the desired outcome needs to be explored before implementation. It runs
the read-only planning brain and returns the proposed outcome, scope, validation, and only material
open questions. For ordinary implementation requests, `managed` establishes the same compact task
contract before its first state-changing operation.

## Execution boundary

- Hands inherit OpenCode's filesystem, environment, network, and process access. OpenCode itself is
  the trust boundary; this profile does not sandbox individual commands.
- Structured hand paths are constrained to their assigned workspace. `hand_run` is an ordinary
  local shell and can access anything available to OpenCode.
- Agents do not commit, push, reset, clean, or rewrite refs unless the user explicitly changes the
  orchestration contract.
- Tool output is sanitized and bounded before it enters model context or session history. The
  beginning and end are retained so both the initiating error and final diagnostics remain visible.
- Commands are never retried automatically. The brain inspects failures before deciding whether a
  retry is safe.

## Child brains

- Reviewers receive only structured read, search, and list tools; local shell execution is denied.
- Workers require a clean primary Git checkout and receive detached worktrees under the OpenCode
  managed state directory.
- The primary brain checks child status and output before calling `brain_integrate`.
- Integration checks a complete binary patch before applying it as unstaged changes. On conflict,
  neither workspace is changed.
- Integration and discard remove only the exact worker worktree. Child session history remains
  durable.
