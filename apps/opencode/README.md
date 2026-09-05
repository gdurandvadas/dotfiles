# OpenCode Managed Agents

This profile implements a Docker-free Brain–Hands–Session runtime on OpenCode.

- OpenCode is the recoverable brain and durable session log.
- Hands execute directly in OpenCode's environment.
- Child workers use isolated Git worktrees; reviewers receive structured read-only tools.
- OpenCode itself is the trust boundary. Individual hand commands are not sandboxed.

## Start and recover

Apply the dotfiles and launch OpenCode from a project:

```sh
dotfiles apply
oc
```

Recover any existing brain directly from its durable session:

```sh
oc --session <session-id>
```

Choose a per-run execution ceiling without editing the profile:

```sh
oc --budget small
oc --budget standard
oc --budget long --session <session-id>
```

`small` uses Terra at medium reasoning with 60 primary steps. `standard` uses Sol at high reasoning
with 200 primary steps. `long` retains Sol at high reasoning and allows 400 primary steps. Worker
and reviewer ceilings scale with the selected profile. A project can persist its own default in an
`opencode.jsonc` agent override or export `OPENCODE_MANAGED_BUDGET` from `.envrc`; an explicit
launcher flag takes precedence.

For an exact project-specific ceiling, add this to the project's `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "managed": { "steps": 300 },
    "managed-worker": { "steps": 150 },
    "managed-reviewer": { "steps": 80 },
  },
}
```

OpenCode resolves the hard step ceiling when the process starts. If work outgrows its profile,
resume the durable session with a larger budget rather than restarting the task.
One step is an agent turn that may include a tool call, not a complete implementation iteration.
The managed plugin reads the effective merged ceiling once and includes it in model context, so a
project override is visible to the brain when it scopes the run.

No Docker daemon, runtime image, or per-hand provisioning is required.

## Tools

| Contract | Tools |
| --- | --- |
| Session | `session_events`, `session_note` |
| Hands | `hand_run`, `hand_read`, `hand_write`, `hand_edit`, `hand_search`, `hand_list`, `hand_status` |
| Brains | `brain_spawn`, `brain_status`, `brain_collect`, `brain_integrate`, `brain_discard` |

Hand names are logical labels rather than provisioned runtimes. Structured file tools stay inside
the assigned workspace. `hand_run` starts an ordinary local shell with that workspace as its
working directory and inherits everything available to the OpenCode process. It defaults to a
15-minute deadline, honors OpenCode cancellation, terminates descendants, and returns bounded
head-and-tail output. A caller can request a longer deadline up to one hour when a repository gate
requires it.

Recent session recovery should use `session_events` with `tail`. That path asks OpenCode only for
the requested recent events; exact `start` and `end` slices remain available for older history.
Recursive list and search operations omit common generated directories by default and can include
them explicitly for diagnostics.

## Parallel work

`brain_spawn` accepts `reviewer` or `worker`:

- Reviewers inspect the primary checkout through structured read-only tools and cannot run a shell.
- Workers are allowed only when the primary checkout is clean. Each receives its own detached Git
  worktree and cannot mutate Git metadata.
- `brain_integrate` creates a complete binary patch, checks it against the primary checkout, and
  applies it unstaged. Conflicts do not modify either checkout.
- `brain_discard` removes a worker's worktree but retains its session history.

The environment running OpenCode must provide Bash, Git, and ripgrep. Project-specific toolchains
are used directly; there is no second container environment to configure.

The managed profile enables automatic compaction with stale-tool-output pruning, disables duplicate
OpenCode snapshots, and ignores project-specific generated trees in the file watcher. Git and the
isolated worker worktrees remain the source of change recovery. A project that specifically needs
OpenCode UI snapshot rollback can override `snapshot` in its own `opencode.jsonc`.

## Development

```sh
cd apps/opencode
bun install
bun test
bun run typecheck
```

The test suite includes a real local-process smoke test and does not require Docker.
