#!/usr/bin/env bash
# Launch Crush with work environment (Anthropic-compatible proxy).
# Usage: cr-work [crush args...]

set -e

CRUSH_HOME="$HOME/.config/crush-work"
CRUSH_DATA_DIR="$HOME/.local/share/crush-work"

mkdir -p "$CRUSH_DATA_DIR"

export CRUSH_GLOBAL_CONFIG="$CRUSH_HOME/crush.json"
export CRUSH_GLOBAL_DATA="$CRUSH_DATA_DIR/crush.json"

exec crush "$@"
