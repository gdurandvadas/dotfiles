#!/usr/bin/env bash
# Switch to work OpenCode config and launch.
# Usage:
#   oc-work              → uses Copilot provider (default)
#   oc-work --copilot    → uses Copilot provider
#   oc-work --bedrock    → uses AWS Bedrock provider
#   oc-work --claude     → uses Claude (via opencode-claude-auth)

set -e

provider="copilot"
while [[ $# -gt 0 ]]; do
  case $1 in
    --copilot) provider="copilot"; shift ;;
    --bedrock) provider="bedrock"; shift ;;
    --claude) provider="claude"; shift ;;
    *) break ;;
  esac
done

WORK_CONFIG="$HOME/.config/dotfiles/config/opencode/config.work.$provider.json"

if [[ ! -f "$WORK_CONFIG" ]]; then
  echo "Work config not found: $WORK_CONFIG"
  echo ""
  echo "Create it at: $WORK_CONFIG"
  exit 1
fi

LINK="$HOME/.config/opencode/config.json"
ORIGINAL="$(readlink "$LINK" 2>/dev/null || echo "$HOME/.config/dotfiles/config/opencode/config.json")"

ln -sf "$WORK_CONFIG" "$LINK"
trap 'ln -sf "'"$ORIGINAL"'" "'"$LINK"'"' EXIT INT TERM

opencode "$@"
