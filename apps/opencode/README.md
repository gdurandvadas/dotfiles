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

A Project has one Objective and one visible `project/<id>` branch in the repository checkout the
user opened. The first complete draft checks out that branch; approval activates the same plan
rather than creating it later. The checkout does not need to be clean: tracked and untracked local
files stay visible, while pre-existing staged files are unstaged to keep commits intentional. It
advances through milestones whose tasks are sized by reasoning risk:

- S for an exact demonstrated pattern.
- M for ordinary bounded component or multi-file work.
- L for novel, ambiguous, architectural, or high-risk work.

The `project` primary / Terra designs, implements, recovers, validates, and publishes directly in
that checkout. It uses native `explore` for local research and `scout` for external research, but
repository implementation is never handed to a background agent. It cannot read secrets, run
destructive Git operations, or publish outside the bounded Project flow. The bounded `default`
primary remains available and redirects work on a checked-out Project branch back to `/project`.

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

Tasks always run sequentially in the visible checkout. `project_next` returns an existing running
task after interruption, so a new session can inspect the files and continue instead of waiting on
an unavailable session. The primary runs focused checks, stages explicit paths, commits, and
records the result. Credential-bearing environment files and blanket staging commands are
excluded. The visible checkout HEAD is authoritative.

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
