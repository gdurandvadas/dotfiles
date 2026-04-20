#!/usr/bin/env bash
# Switch to personal OpenCode config and launch.
# Usage:
#   oc-pers           → uses Copilot provider (default)
#   oc-pers --copilot → uses Copilot provider
#   oc-pers --claude  → uses Claude (via opencode-claude-auth)

set -e

provider="copilot"
while [[ $# -gt 0 ]]; do
  case $1 in
    --copilot) provider="copilot"; shift ;;
    --claude) provider="claude"; shift ;;
    *) break ;;
  esac
done

LINK="$HOME/.config/opencode/config.json"

if [[ "$provider" == "claude" ]]; then
  CONFIG="$HOME/.config/dotfiles/config/opencode/config.claude.json"
else
  CONFIG="$HOME/.config/dotfiles/config/opencode/config.json"
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "Config not found: $CONFIG"
  exit 1
fi

ORIGINAL="$(readlink "$LINK" 2>/dev/null || echo "$HOME/.config/dotfiles/config/opencode/config.json")"
ln -sf "$CONFIG" "$LINK"
trap 'ln -sf "'"$ORIGINAL"'" "'"$LINK"'"' EXIT INT TERM

exec opencode "$@"
