#!/usr/bin/env bash
# Launch OpenCode v1 with the personal managed-agent configuration.
# Usage: oc [--budget small|standard|long] [opencode args...]

set -euo pipefail

CONFIG_DIR="$HOME/.config/opencode-personal"

export OPENCODE_CONFIG="$CONFIG_DIR/profile.jsonc"
export OPENCODE_CONFIG_DIR="$CONFIG_DIR"

# Use Home Manager–installed language servers; do not auto-download duplicates.
export OPENCODE_DISABLE_LSP_DOWNLOAD=true

budget="${OPENCODE_MANAGED_BUDGET:-small}"
opencode_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --budget)
      if [[ $# -lt 2 ]]; then
        echo "oc: --budget requires small, standard, or long" >&2
        exit 2
      fi
      budget="$2"
      shift 2
      ;;
    --budget=*)
      budget="${1#--budget=}"
      shift
      ;;
    *)
      opencode_args+=("$1")
      shift
      ;;
  esac
done

case "$budget" in
  small)
    budget_config='{"agent":{"managed":{"model":"openai/gpt-5.6-terra","reasoningEffort":"medium","steps":60},"managed-worker":{"steps":48},"managed-reviewer":{"steps":32},"managed-plan":{"steps":32}}}'
    ;;
  standard)
    budget_config='{}'
    ;;
  long)
    budget_config='{"agent":{"managed":{"steps":400},"managed-worker":{"steps":200},"managed-reviewer":{"steps":96},"managed-plan":{"steps":96}}}'
    ;;
  *)
    echo "oc: unknown budget '$budget'; expected small, standard, or long" >&2
    exit 2
    ;;
esac
export OPENCODE_MANAGED_BUDGET="$budget"

if [[ "$budget_config" != '{}' ]]; then
  if [[ -n "${OPENCODE_CONFIG_CONTENT:-}" ]]; then
    if ! command -v jq >/dev/null 2>&1; then
      echo "oc: jq is required to merge --budget with OPENCODE_CONFIG_CONTENT" >&2
      exit 1
    fi
    if ! merged_config="$(jq -cn \
      --argjson existing "$OPENCODE_CONFIG_CONTENT" \
      --argjson budget "$budget_config" \
      '$existing * $budget')"; then
      echo "oc: OPENCODE_CONFIG_CONTENT is not valid JSON" >&2
      exit 2
    fi
    export OPENCODE_CONFIG_CONTENT="$merged_config"
  else
    export OPENCODE_CONFIG_CONTENT="$budget_config"
  fi
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "OpenCode v1 is not installed. Run: mise install npm:@opencode-ai/cli" >&2
  exit 1
fi

# Local plugins resolve their pinned API package from the configuration directory.
if [[ ! -d "$CONFIG_DIR/node_modules/@opencode-ai/plugin" ]]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is required to install the pinned OpenCode plugin dependency." >&2
    exit 1
  fi
  (
    cd "$CONFIG_DIR"
    bun install --frozen-lockfile --production
  )
fi

plugin_package="$CONFIG_DIR/node_modules/@opencode-ai/plugin/package.json"
expected_version="$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$plugin_package" | head -1)"
actual_version="$(opencode --version)"
if [[ -z "$expected_version" ]]; then
  echo "oc: unable to determine the installed OpenCode plugin version" >&2
  exit 1
fi
expected_api_version="${expected_version%.*}"
actual_api_version="${actual_version%.*}"
if [[ "$actual_api_version" != "$expected_api_version" ]]; then
  echo "oc: OpenCode CLI $actual_version is incompatible with plugin $expected_version." >&2
  echo "oc: install the configured version with: mise install npm:@opencode-ai/cli" >&2
  exit 1
fi
if [[ "$actual_version" != "$expected_version" ]]; then
  echo "oc: OpenCode CLI $actual_version differs from plugin $expected_version by a patch release; continuing." >&2
fi

exec opencode "${opencode_args[@]}"
