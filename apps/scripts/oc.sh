#!/usr/bin/env bash
# Launch OpenCode v1 with the personal wave workflow configuration.
# Usage: oc [opencode args...]

set -euo pipefail

CONFIG_DIR="$HOME/.config/opencode-personal"

export OPENCODE_CONFIG="$CONFIG_DIR/opencode.jsonc"
export OPENCODE_CONFIG_DIR="$CONFIG_DIR"

# Use Home Manager–installed language servers; do not auto-download duplicates.
export OPENCODE_DISABLE_LSP_DOWNLOAD=true

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode v1 is not installed. Run: mise install npm:@opencode-ai/cli" >&2
  exit 1
fi

# Local plugins resolve their pinned API package from the configuration directory.
if [[ ! -d "$CONFIG_DIR/node_modules/@opencode-ai/plugin" ||
      ! -d "$CONFIG_DIR/node_modules/@opentui/solid" ||
      ! -d "$CONFIG_DIR/node_modules/solid-js" ]]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is required to install the pinned OpenCode plugin dependency." >&2
    exit 1
  fi
  (
    cd "$CONFIG_DIR"
    bun install --frozen-lockfile --production
  )
fi

exec opencode "$@"
