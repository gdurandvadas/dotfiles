# Dotfiles bootstrap.
# Run from the repo root (e.g. ~/.config/dotfiles).

DOTFILES_DIR ?= $(HOME)/.config/dotfiles
REPOS ?= $(shell find . -maxdepth 2 -name .git -type d | sed 's|^\./||; s|/\.git$$||; s|^\.git$$|.|' | grep -v '^\.$$')

.PHONY: update sync-default new repo-status

update:
	@DOTFILES_DIR="$(DOTFILES_DIR)" bash "$(DOTFILES_DIR)/apps/scripts/dotfiles.sh" update

sync-default:
	@if [ -z "$(strip $(REPOS))" ]; then \
		echo "No child Git repositories discovered."; \
		exit 0; \
	fi
	@for repo in $(REPOS); do \
		if [ ! -d "$$repo/.git" ]; then \
			echo "Skipping $$repo: not a Git repository."; \
			continue; \
		fi; \
		echo "==> $$repo"; \
		stash_created=0; \
		if ! git -C "$$repo" diff --quiet || ! git -C "$$repo" diff --cached --quiet || [ -n "$$(git -C "$$repo" ls-files --others --exclude-standard)" ]; then \
			before_stash=$$(git -C "$$repo" rev-parse -q --verify refs/stash 2>/dev/null || true); \
			if ! git -C "$$repo" stash push --include-untracked -m "dotfiles sync-default $$(date -u +%Y%m%dT%H%M%SZ)" --quiet; then \
				echo "Failed to stash local changes in $$repo."; \
				exit 1; \
			fi; \
			after_stash=$$(git -C "$$repo" rev-parse -q --verify refs/stash 2>/dev/null || true); \
			if [ "$$before_stash" != "$$after_stash" ]; then \
				stash_created=1; \
			fi; \
		fi; \
		if ! git -C "$$repo" fetch origin --quiet; then \
			echo "Failed to fetch origin for $$repo."; \
			exit 1; \
		fi; \
		default_branch=$$(git -C "$$repo" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'); \
		if [ -z "$$default_branch" ]; then \
			default_branch=$$(git -C "$$repo" remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' | head -1); \
		fi; \
		if [ -z "$$default_branch" ]; then \
			default_branch=$$(git -C "$$repo" rev-parse --abbrev-ref HEAD); \
		fi; \
		echo "Default branch: $$default_branch"; \
		if ! git -C "$$repo" checkout "$$default_branch" --quiet; then \
			echo "Failed to checkout $$default_branch in $$repo."; \
			exit 1; \
		fi; \
		if ! git -C "$$repo" pull --ff-only origin "$$default_branch" --quiet; then \
			echo "Failed to fast-forward $$repo from origin/$$default_branch."; \
			exit 1; \
		fi; \
		if [ "$$stash_created" = 1 ]; then \
			if ! git -C "$$repo" stash pop --quiet; then \
				echo "Failed to restore stashed changes in $$repo. Resolve conflicts before continuing."; \
				exit 1; \
			fi; \
		fi; \
	done

new:
	@if [ -z "$(strip $(BRANCH))" ]; then \
		echo "Missing BRANCH. Usage: make new BRANCH=codex/example REPOS=\"repo-a repo-b\""; \
		exit 1; \
	fi
	@if [ -z "$(strip $(REPOS))" ]; then \
		echo "Missing REPOS. Usage: make new BRANCH=$(BRANCH) REPOS=\"repo-a repo-b\""; \
		exit 1; \
	fi
	@for repo in $(REPOS); do \
		if [ ! -d "$$repo/.git" ]; then \
			echo "Skipping $$repo: not a Git repository."; \
			continue; \
		fi; \
		if git -C "$$repo" show-ref --verify --quiet "refs/heads/$(BRANCH)"; then \
			echo "Branch $(BRANCH) already exists in $$repo."; \
			exit 1; \
		fi; \
		echo "Creating $(BRANCH) in $$repo"; \
		git -C "$$repo" checkout -b "$(BRANCH)" --quiet; \
	done

repo-status:
	@if [ -z "$(strip $(REPOS))" ]; then \
		echo "No child Git repositories discovered."; \
		exit 0; \
	fi
	@for repo in $(REPOS); do \
		if [ ! -d "$$repo/.git" ]; then \
			echo "$$repo <not a Git repository>"; \
			continue; \
		fi; \
		branch=$$(git -C "$$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached); \
		dirty=$$(git -C "$$repo" status --porcelain); \
		if [ -z "$$dirty" ]; then state=clean; else state=dirty; fi; \
		ab=$$(git -C "$$repo" status --porcelain=v2 --branch 2>/dev/null | awk '/^# branch.ab/ { print "ahead=" substr($$3, 2) " behind=" substr($$4, 2) }'); \
		add_del=$$(git -C "$$repo" diff --numstat 2>/dev/null | awk '{ add += $$1; del += $$2 } END { printf "+%d -%d", add, del }'); \
		echo "$$repo <branch $$branch> <$$state $$ab $$add_del>"; \
	done
