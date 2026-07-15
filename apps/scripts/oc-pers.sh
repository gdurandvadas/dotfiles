#!/usr/bin/env bash
# Launch OpenCode with personal environment (OpenAI, no work MCPs or agents).
# Usage: oc-pers [opencode args...]

set -e

export OPENCODE_CONFIG="$HOME/.config/opencode-personal/config.jsonc"
export OPENCODE_CONFIG_DIR="$HOME/.config/opencode-personal"

# Use Home Manager–installed language servers; do not auto-download duplicates.
export OPENCODE_DISABLE_LSP_DOWNLOAD=true

# GitHub MCP: PAT from env, or fall back to gh auth token
if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token 2>/dev/null)" || true
  export GITHUB_PERSONAL_ACCESS_TOKEN
fi

exec opencode "$@"
