#!/usr/bin/env bash
# Launch OpenCode with personal environment (OpenAI, no work MCPs or agents).
# Usage: oc-pers [opencode args...]

set -e

export OPENCODE_CONFIG="$HOME/.config/opencode-personal/config.jsonc"
export OPENCODE_CONFIG_DIR="$HOME/.config/opencode-personal"

exec opencode "$@"
