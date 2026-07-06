#!/usr/bin/env bash
# Launch OpenCode with work environment (Bedrock/Anthropic + ClickUp MCP).
# Usage: oc-work [opencode args...]

set -e

export OPENCODE_CONFIG="$HOME/.config/opencode-work/config.jsonc"
export OPENCODE_CONFIG_DIR="$HOME/.config/opencode-work"

exec opencode "$@"
