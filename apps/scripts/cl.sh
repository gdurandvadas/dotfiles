#!/usr/bin/env bash
# Launch Claude Code with the work ADE configuration.
# Usage: cl [claude args...]

set -euo pipefail

export CLAUDE_MCP_DIR="$HOME/.claude/mcp"

if [[ -z "${WORK_MCP_URL:-}" && -n "${WORK_MCP_OP_URL_REF:-}" ]] && command -v op >/dev/null 2>&1; then
  export WORK_MCP_URL="$(op read "$WORK_MCP_OP_URL_REF")"
fi

if [[ -z "${WORK_MCP_TOKEN:-}" && -n "${WORK_MCP_OP_TOKEN_REF:-}" ]] && command -v op >/dev/null 2>&1; then
  export WORK_MCP_TOKEN="$(op read "$WORK_MCP_OP_TOKEN_REF")"
fi

mcp_configs=("$HOME/.claude/mcp.json")
if [[ -f "$HOME/.claude/mcp.local.json" ]]; then
  mcp_configs+=("$HOME/.claude/mcp.local.json")
fi

exec claude --mcp-config "${mcp_configs[@]}" "$@"
