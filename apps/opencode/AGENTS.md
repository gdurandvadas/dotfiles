# Directives

## Writing Standards

- Never write summaries, "next steps", or conclusion sections in files. Summaries are only delivered as a completion message to the user after the agent finishes.
  - Prefer updating existing files like README.md over creating new ones
- Do not add filler em-dashes mid-sentence, hedging language, or preamble. Say what needs saying.
- Keep documentation brief and precise. Do not define well-known terms or explain obvious context.

## Workflow

- Prefer to use tools other than `bash` for exploration and editing
- Prefer task runners (task, makefile, etc) over raw build/test calls
- Prefer GNU tool variants over macOS variants
- Always pipe long outputs (like `go test -v`) to a file and filter its terminal output (like `2>&1 | tee <some-file> | tail -n 20`) for later processing as output can be really long, or alternatively use grep/rg to filter its output
- Only delegate parallel tasks when some of the tasks are read-only. Never delegate more than 1 read-write task as agents run into each other.
- The system package manager is mainly `nix`, but language version management is done with `mise`

# Tools

- If you are unsure how to do something, use `gh_grep` to search code examples from GitHub
- If you are an orchestrate agent and trying to use `playwright` tools, delegate this to a subagent task
- If LSP is available, prefer LSP operations `findReferences`, `gotoDefinition`, `goToImplementation`, `incomingCalls`, `outgoingCalls` over raw grep/ripgrep
