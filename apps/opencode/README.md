# OpenCode Managed Agents

This profile implements a Docker-free Brain–Hands–Session runtime on OpenCode v1.17.20.

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

No Docker daemon, runtime image, or per-hand provisioning is required.

## Tools

| Contract | Tools |
| --- | --- |
| Session | `session_events`, `session_note` |
| Hands | `hand_run`, `hand_read`, `hand_write`, `hand_edit`, `hand_search`, `hand_list`, `hand_status` |
| Brains | `brain_spawn`, `brain_status`, `brain_collect`, `brain_integrate`, `brain_discard` |

Hand names are logical labels rather than provisioned runtimes. Structured file tools stay inside
the assigned workspace. `hand_run` starts an ordinary local shell with that workspace as its
working directory and inherits everything available to the OpenCode process.

## Parallel work

`brain_spawn` accepts `reviewer` or `worker`:

- Reviewers inspect the primary checkout through structured read-only tools and cannot run a shell.
- Workers are allowed only when the primary checkout is clean. Each receives its own detached Git
  worktree and cannot mutate Git metadata.
- `brain_integrate` creates a complete binary patch, checks it against the primary checkout, asks
  for approval, and applies it unstaged. Conflicts do not modify either checkout.
- `brain_discard` removes a worker's worktree but retains its session history.

The environment running OpenCode must provide Bash, Git, and ripgrep. Project-specific toolchains
are used directly; there is no second container environment to configure.

## Development

```sh
cd apps/opencode
bun install
bun test
bun run typecheck
```

The test suite includes a real local-process smoke test and does not require Docker.
