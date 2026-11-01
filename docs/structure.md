# Project structure

```
.
├── Makefile               # Bootstrap and switch targets
├── flake.nix              # Entry point — pins all dependencies, exposes switch app
├── default.nix            # Aggregates all modules
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
│   │   └── module.nix     # Reserved for config-only tool additions
│   ├── language-servers/
│   │   └── module.nix     # Home Manager-managed language servers
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
│       └── z.sh              # Open project in Zed
└── docs/
    └── (this documentation)
```
