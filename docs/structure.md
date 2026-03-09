# Project structure

```
.
├── Makefile               # Bootstrap and switch targets (make bootstrap, make switch-personal, …)
├── flake.nix              # Entry point — pins all dependencies, exposes switch-personal/switch-work apps
├── default.nix            # Aggregates all modules
├── unfree-packages.nix   # Single source of unfree package names (base + darwinExtra)
├── hosts/
│   ├── personal.nix       # Personal profile host config
│   ├── work.nix           # Work profile host config
│   ├── darwin.nix         # Optional nix-darwin system config (workstation flake)
│   ├── local.nix          # GITIGNORED — your identity (copy from example)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   ├── user.nix           # Defines options.my.user.* (identity contract)
│   ├── shell.nix          # Zsh, Starship, direnv, git, CLI utilities
│   ├── terminal.nix       # Alacritty, Zellij, nerd fonts
│   ├── editor.nix         # Zed editor + language servers
│   ├── ai.nix             # OpenCode AI orchestrator
│   ├── tools.nix          # Unfree/extra tools (1Password CLI, Brave, mise, gh, claude-code)
│   ├── scripts.nix        # Custom scripts as Nix packages (dotfiles-switch, dotfiles)
│   └── work.nix           # Work profile overrides (git email, opencode config)
├── config/
│   ├── alacritty/
│   │   ├── alacritty.toml
│   │   ├── keybindings.toml
│   │   └── themes/        # alacritty_dark.toml, alacritty_light.toml (theme-switch symlinks theme.toml)
│   ├── zed/
│   │   ├── settings.json  # Zed behavior, LSP config, theme
│   │   └── keymap.json    # Custom keybindings
│   ├── starship/          # starship_dark.toml, starship_light.toml (theme-switch symlinks)
│   ├── zellij/
│   │   ├── config.kdl
│   │   └── layouts/default.kdl
│   ├── mise/
│   │   └── config.toml
│   ├── opencode/
│   │   ├── config.json    # Personal OpenCode model + MCP servers
│   │   ├── work-config.json  # Work OpenCode config
│   │   └── skills/
│   │       └── research.md
│   └── scripts/
│       ├── theme-switch.zsh  # Dark/light sync for Alacritty + Starship
│       ├── mise.zsh          # Mise (polyglot runtime manager) integration
│       └── dotfiles.sh       # Unified home-manager / darwin switch script (dotfiles CLI)
└── docs/
    └── (this documentation)
```
