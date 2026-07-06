#!/usr/bin/env bash
# Launch Crush with personal environment (OpenAI, no work MCPs or skills).
# Usage: cr-pers [crush args...]

set -e

CRUSH_HOME="$HOME/.config/crush-personal"
CRUSH_DATA_DIR="$HOME/.local/share/crush-personal"

mkdir -p "$CRUSH_DATA_DIR"

export CRUSH_GLOBAL_CONFIG="$CRUSH_HOME/crush.json"
export CRUSH_GLOBAL_DATA="$CRUSH_DATA_DIR/crush.json"

exec crush "$@"
