---
name: repo-manager
description: Automates multi-repository synchronization, branch creation, and repository health checks using this dotfiles workspace Makefile. Use when coordinating work across child Git repositories.
compatibility: "Requires bash, Git, and GNU Make-compatible make"
---

# Repo Manager

Use the root `Makefile` as the control surface for multi-repository operations.
Avoid hand-running checkout or pull loops across child repositories when a
Makefile target exists.

## Workflow

1. Read `apps/pi/project/memory/CORE.md` if it exists.
2. Run `make repo-status` to inspect all discovered repositories.
3. Run `make sync-default` before creating branches across multiple repos.
4. Create coordinated branches with:

   ```bash
   make new BRANCH=codex/example REPOS="repo-a repo-b"
   ```

5. If any command reports conflicts, uncommitted work that cannot be stashed, or
   a failed checkout, stop and report the failing repository and command output.

## Validation

After branch or sync operations, run `make repo-status` again and summarize the
branch, cleanliness, ahead/behind state, and diff counts for each repository.
