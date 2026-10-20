#!/usr/bin/env bash
# Update the default branch of every Git repository directly below the current directory.
# Usage: git-update-all [--force]
set -euo pipefail

force=false
case "$#" in
  0) ;;
  1)
    if [[ "$1" == "--force" ]]; then
      force=true
    else
      echo "Usage: git-update-all [--force]" >&2
      exit 2
    fi
    ;;
  *)
    echo "Usage: git-update-all [--force]" >&2
    exit 2
    ;;
esac

for directory in */; do
  [[ -d "$directory" ]] || continue

  if ! (
    cd -- "$directory"

    if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]]; then
      exit 0
    fi
    if ! git remote get-url origin >/dev/null 2>&1; then
      echo "Skipping $PWD: no 'origin' remote." >&2
      exit 0
    fi

    if ! "$force" && [[ -n "$(git status --porcelain)" ]]; then
      echo "Skipping $PWD: worktree has uncommitted changes (use --force to discard tracked changes)." >&2
      exit 0
    fi

    git fetch --prune origin
    git remote set-head origin --auto >/dev/null
    default_ref="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD)" || {
      echo "Skipping $PWD: could not determine origin's default branch." >&2
      exit 0
    }
    default_branch="${default_ref#origin/}"

    echo "Updating $PWD ($default_branch)"
    if git show-ref --verify --quiet "refs/heads/$default_branch"; then
      if "$force"; then
        git switch --discard-changes "$default_branch"
      else
        git switch "$default_branch"
      fi
    else
      git switch --track --create "$default_branch" "$default_ref"
    fi

    if "$force"; then
      git reset --hard "$default_ref"
    else
      git merge --ff-only "$default_ref"
    fi
  ); then
    echo "Failed to update $directory." >&2
  fi
done
