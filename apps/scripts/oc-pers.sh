#!/usr/bin/env bash
# Launch OpenCode with the personal configuration.
# Usage: oc-pers [opencode args...]

set -e

export OPENCODE_CONFIG="$HOME/.config/opencode-personal/config.jsonc"
export OPENCODE_CONFIG_DIR="$HOME/.config/opencode-personal"

# Use Home Manager–installed language servers; do not auto-download duplicates.
export OPENCODE_DISABLE_LSP_DOWNLOAD=true

exec opencode "$@"
