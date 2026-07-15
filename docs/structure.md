# Project structure

```
.
├── Makefile               # Bootstrap and switch targets
├── flake.nix              # Entry point — pins all dependencies, exposes switch app
├── default.nix            # Aggregates all modules
├── unfree-packages.nix    # Single source of unfree package names (base + darwinExtra)
├── hosts/
│   ├── personal.nix       # Host config
│   ├── darwin.nix         # Optional nix-darwin system config (workstation flake)
│   ├── local.nix          # GITIGNORED — your identity (copy from example)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   └── user.nix           # Defines options.my.user.* (identity contract)
├── apps/
│   ├── shell/
│   │   └── module.nix     # Zsh, direnv, git, shell defaults, baseline CLI utilities
│   ├── tools/
│   │   └── module.nix     # Additional CLI/dev tools (unfree and extra)
│   ├── opencode/
│   │   ├── module.nix     # OpenCode package + Home Manager wiring
│   │   ├── config.jsonc   # Personal OpenCode configuration
│   │   ├── agents/        # Personal primary and subagent prompts
│   │   ├── commands/      # Personal task commands
│   │   ├── lib/           # Deterministic task state machine
│   │   ├── plugins/       # Personal task integration
│   │   └── tools/         # Personal task tools
│   ├── claude/
│   │   ├── module.nix     # Claude Code Home Manager wiring
│   │   ├── CLAUDE.md      # Work ADE instructions
│   │   ├── agents/        # Work task subagents
│   │   ├── commands/      # Work task slash commands
│   │   ├── mcp/           # Local task MCP server
│   │   └── mcp.json       # Env-configured MCP servers
│   ├── alacritty/
│   │   ├── module.nix     # Alacritty package + Home Manager wiring
│   │   ├── alacritty.toml
│   │   ├── keybindings.toml
│   │   └── themes/        # alacritty_dark.toml, alacritty_light.toml
│   ├── zed/
│   │   ├── module.nix     # Zed package + language server wiring
│   │   ├── settings.json
│   │   └── keymap.json
│   ├── starship/
│   │   ├── module.nix
│   │   └── *.toml         # starship_dark.toml, starship_light.toml
│   ├── zellij/
│   │   ├── module.nix
│   │   ├── config.kdl
│   │   └── layouts/default.kdl
│   ├── mise/
│   │   ├── module.nix
│   │   └── config.toml
│   └── scripts/
│       ├── module.nix        # Script packaging and zsh helper links
│       ├── dotfiles.sh       # Unified home-manager / darwin switch script
│       ├── theme-switch.zsh  # Dark/light sync for Alacritty + Starship
│       ├── mise.zsh          # Mise (polyglot runtime manager) integration
│       ├── cl.sh              # Launch Claude Code with work MCP configuration
│       ├── oc-pers.sh        # Launch OpenCode with personal config
│       ├── z.sh              # Open project in Zed
│       └── c.sh              # Open project in Cursor
└── docs/
    └── (this documentation)
```
