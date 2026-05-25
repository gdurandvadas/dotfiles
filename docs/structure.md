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
│   └── work.nix           # Work profile overrides (git email)
├── apps/
│   ├── shell/
│   │   └── module.nix     # Zsh, direnv, git, shell defaults, baseline CLI utilities
│   ├── tools/
│   │   └── module.nix     # Additional CLI/dev tools (unfree and extra)
│   ├── alacritty/
│   │   ├── module.nix     # Alacritty package + Home Manager wiring
│   │   ├── alacritty.toml
│   │   ├── keybindings.toml
│   │   └── themes/        # alacritty_dark.toml, alacritty_light.toml (theme-switch symlinks theme.toml)
│   ├── zed/
│   │   ├── module.nix     # Zed package + language server wiring
│   │   ├── settings.json  # Zed behavior, LSP config, theme
│   │   └── keymap.json    # Custom keybindings
│   ├── starship/
│   │   ├── module.nix     # Starship package wiring
│   │   └── *.toml         # starship_dark.toml, starship_light.toml
│   ├── zellij/
│   │   ├── module.nix     # Zellij package + Home Manager wiring
│   │   ├── config.kdl
│   │   └── layouts/default.kdl
│   ├── mise/
│   │   ├── module.nix     # Mise package + Home Manager wiring
│   │   └── config.toml
│   └── scripts/
│       ├── module.nix     # Script packaging and zsh helper links
│       ├── theme-switch.zsh  # Dark/light sync for Alacritty + Starship
│       ├── mise.zsh          # Mise (polyglot runtime manager) integration
│       └── dotfiles.sh       # Unified home-manager / darwin switch script (dotfiles CLI)
└── docs/
    └── (this documentation)
```
