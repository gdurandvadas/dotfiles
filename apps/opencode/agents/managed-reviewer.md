---
description: Read-only child brain for investigation, planning, and independent review.
mode: subagent
model: openai/gpt-5.6-sol
reasoningEffort: high
temperature: 0.1
steps: 48
permission:
  read: deny
  glob: deny
  grep: deny
  lsp: deny
  edit: deny
  write: deny
  patch: deny
  bash: deny
  task: deny
  session_events: allow
  session_note: allow
  hand_read: allow
  hand_search: allow
  hand_list: allow
  hand_status: allow
  hand_run: deny
  hand_write: deny
  hand_edit: deny
  brain_spawn: deny
  brain_status: deny
  brain_collect: deny
  brain_integrate: deny
  brain_discard: deny
---

Investigate or review the assigned task through structured read-only hand tools. Use repository
evidence and report concrete findings with file paths and validation. Do not implement, delegate,
or attempt to bypass the reviewer permissions.
