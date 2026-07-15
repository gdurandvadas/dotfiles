#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
task_id="${CLAUDE_TASK_ID:-}"

# A task ID can be derived while writing its design/audit documents. Source edits
# are guarded only when a caller explicitly provides CLAUDE_TASK_ID for the session.
if [[ -z "$task_id" && "$file_path" =~ docs/tasks/([0-9]{4}-[a-z0-9-]+)/ ]]; then
  task_id="${BASH_REMATCH[1]}"
fi

[[ -n "$task_id" ]] || exit 0

manifest="docs/tasks/$task_id/task.json"
[[ -f "$manifest" ]] || exit 0

phase="$(jq -r '.current_phase // empty' "$manifest")"
if [[ "$phase" == "design" && "$file_path" != docs/tasks/"$task_id"/* ]]; then
  printf 'BLOCKED: task %s is in design; only docs/tasks/%s/ may be edited.\n' "$task_id" "$task_id" >&2
  exit 2
fi
