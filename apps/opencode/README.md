# OpenCode Personal Profile

Personal OpenCode configuration for efficient standalone work and autonomous schema-v5 Projects.
Launch it with `oc-pers`; Home Manager links this directory into the active configuration.

## Two workflows

| Flow | Entry | Use |
|---|---|---|
| Standalone | `@default` | One bounded change without Project state |
| Project | `/project <name-or-id>` | Objective-driven delivery through validated draft PR |

`/project` lists current v5 Projects when empty, resumes an ID, or starts design for a new name.
Older Project records stay untouched as read-only history and are not resumed or migrated.
A new name is only a label: without substantive conversational context, Project asks for the
Objective before any repository research.

## Product model

A Project has one Objective and one cumulative `project/<id>` worktree. The first complete draft
plan creates that branch/worktree; approval activates the same plan rather than creating it later.
It advances
through milestones whose tasks are sized by reasoning risk:

- `implement-s` / Luna for an exact demonstrated pattern.
- `implement-m` / Terra for ordinary bounded component or multi-file work.
- `implement-l` / Sol for novel, ambiguous, architectural, or high-risk work.

The `project` primary / Terra designs, routes, integrates, recovers, validates, and publishes. It
uses native `explore` for local research and `scout` for external research. Implementers cannot
delegate, mutate Project state, push, publish, read secrets, or run destructive Git operations.
The bounded `default` primary remains available and has no Project or delegation permission.

## Autonomy boundary

The Objective, current milestone, repository policy, and reversibility define the working
envelope. The Project proceeds without asking when a discovered change is necessary inside that
envelope. This includes local Docker, tooling, test-harness, and prerequisite repairs required to
continue.

When a task reaches another responsibility, `explore` performs an independent bird's-eye
assessment of necessity, impact, affected responsibilities, alternatives, and compatibility.
Necessary work stays in the current task or becomes another task. The user is asked only for:

- an Objective or observable-behavior change;
- a new or materially changed milestone;
- an explicit repository or user guardrail;
- an irreversible or destructive action;
- an unauthorized external system, credential, or publication;
- a conflict between authoritative repository policies.

User answers resume the same task. S → M → L escalation also preserves the same worktree and
partial work.

## Execution and validation

Tasks are sequential by default. The approved plan may declare an independent parallel group with
no dependencies or overlapping expected surfaces. Those tasks receive temporary branches and
worktrees from the same validated Project revision. Results compose into the cumulative worktree.
Actual overlap or a merge conflict restores a clean authoritative worktree and automatically
serializes the remaining work.

Implementers run focused checks and commit before returning one structured outcome:
`IMPLEMENTED`, `RESEARCH_NEEDED`, `SCOPE_REVIEW`, `TIER_MISMATCH`, or `NEEDS_USER`.
For completion, the clean assigned worktree HEAD is authoritative. A stale revision copied through
an agent response is recorded and reconciled instead of blocking Project state.

Milestone validation uses the exact commands declared by repository policy. Commands run
synchronously in the Project worktree and return on pass, failure, timeout, or interruption.
There are no polling tokens, background runners, repair states, gate bindings, or evidence-owner
hierarchies. A failure keeps the milestone active and returns diagnostics to implementation.
Repeated failure fingerprints distinguish unchanged baseline failures from new or worsened ones;
repository policy decides whether an unchanged unrelated baseline may continue. An allowed
unchanged fingerprint is recorded through `project_report` and accepted only while it remains
identical.

A milestone pass records evidence at one cumulative revision. Completion requires every
milestone and Objective criterion, a clean branch, `git push`, and `gh pr create --draft` against
the captured base branch. Invalid GitHub authentication enters `waiting` with `gh auth login`;
publication resumes after authentication is repaired.

## State and tools

Repository-local ignored state is intentionally small:

```text
.projects/
  .gitignore
  <project-id>/
    project.json
    logs/
      <foreground-validation>.log
```

The seven tools are `project_open`, `project_plan`, `project_status`, `project_next`,
`project_context`, `project_report`, and `project_validate`. The manifest stores the Objective,
plan history, milestones and tasks, scope assessments, focused checks, foreground evidence,
questions and answers, failure fingerprints, and the draft PR URL.

Configuration is deny-first, loop recovery is automatic for Project agents, native skills and
language servers remain enabled, and source-control publication uses the installed `gh` CLI rather
than a large GitHub MCP server.
