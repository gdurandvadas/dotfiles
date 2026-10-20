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

# Install CLI and plugin together from the profile's single frozen lockfile.
# Always reconcile: an existing node_modules directory may belong to an older profile.
if ! command -v bun >/dev/null 2>&1; then
  echo "oc: Bun is required to install the locked OpenCode runtime. Run: mise install bun" >&2
  exit 1
fi
if ! (cd "$CONFIG_DIR" && bun install --frozen-lockfile --production >&2); then
  echo "oc: unable to install the locked OpenCode runtime; check the install error above." >&2
  exit 1
fi

# Never resolve OpenCode through PATH: Homebrew, mise, and project-local versions
# can update independently of this profile's plugin API.
# Use the native Apple Silicon package directly. The opencode-ai wrapper ships
# a placeholder executable that relies on postinstall and can survive a no-op install.
opencode_bin="$CONFIG_DIR/node_modules/opencode-darwin-arm64/bin/opencode"
if [[ ! -x "$opencode_bin" ]]; then
  echo "oc: the locked OpenCode executable is missing: $opencode_bin" >&2
  exit 1
fi

exec "$opencode_bin" "${opencode_args[@]}"
