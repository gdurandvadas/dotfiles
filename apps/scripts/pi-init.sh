#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pi-init [--force] [--yes] [--dry-run]

Initialize or update a project-local .pi directory from the dotfiles template.

Options:
  --force     Overwrite existing files without prompting
  --yes       Assume yes for prompts (same as --force)
  --dry-run   Show what would happen without writing files
  -h, --help  Show this help text
EOF
}

FORCE=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|--yes)
      FORCE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/.config/dotfiles}"
TEMPLATE_DIR="$DOTFILES_DIR/apps/pi/project"
TARGET_DIR="$(pwd)/.pi"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "Template directory not found: $TEMPLATE_DIR" >&2
  exit 1
fi

SOURCE_VERSION="unknown"
if [[ -f "$TEMPLATE_DIR/VERSION" ]]; then
  SOURCE_VERSION="$(tr -d '\n' < "$TEMPLATE_DIR/VERSION")"
fi

TARGET_VERSION="missing"
if [[ -f "$TARGET_DIR/VERSION" ]]; then
  TARGET_VERSION="$(tr -d '\n' < "$TARGET_DIR/VERSION")"
fi

echo "Pi template source: $TEMPLATE_DIR"
echo "Pi template version: $SOURCE_VERSION"
echo "Target directory: $TARGET_DIR"
echo "Target version: $TARGET_VERSION"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Dry run:"
  echo "- Would sync $TEMPLATE_DIR -> $TARGET_DIR"
  echo "- Would set .pi/VERSION to $SOURCE_VERSION"
  echo "- Would update .pi/CHANGELOG.md from template"
  if [[ -d "$TARGET_DIR" ]]; then
    echo "- Existing .pi detected (prompt would be shown without --force)"
  fi
  exit 0
fi

if [[ -d "$TARGET_DIR" && "$FORCE" -ne 1 ]]; then
  echo
  if [[ ! -t 0 ]]; then
    echo "Non-interactive shell detected. Re-run with --force to overwrite existing .pi." >&2
    exit 1
  fi
  read -r -p ".pi already exists. Overwrite with template version $SOURCE_VERSION? [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *)
      echo "Cancelled."
      exit 0
      ;;
  esac
fi

mkdir -p "$TARGET_DIR"

# Rsync gives predictable sync behavior and removes stale files from old template versions.
rsync -a --delete "$TEMPLATE_DIR/" "$TARGET_DIR/"

echo
echo "Initialized .pi from template version $SOURCE_VERSION."
echo "Changelog: $TARGET_DIR/CHANGELOG.md"
