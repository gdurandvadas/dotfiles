# dotfiles

Deterministic, AI-orchestrated development environment for a polyglot stack (Go, Rust, TypeScript, SQL).

Powered by **Nix Flakes** + **Home Manager** + **OpenCode**.

## Structure

```
.
├── flake.nix              # Entry point — pins all dependencies
├── default.nix            # Aggregates all modules
├── hosts/
│   └── workstation.nix    # Machine identity (username, homeDirectory)
├── modules/
│   ├── zed.nix            # Zed editor + language servers
│   ├── opencode.nix       # OpenCode AI orchestrator
│   ├── terminal.nix       # Zsh, Starship, direnv, git, CLI tools
│   └── scripts.nix        # Custom scripts as Nix packages
└── config/
    ├── zed/
    │   ├── settings.json  # Zed behavior, LSP config, theme
    │   └── keymap.json    # Custom keybindings
    └── opencode/
        ├── config.json    # OpenCode model + MCP servers
        └── skills/
            └── research.md
```

## Requirements

Bare minimum to bootstrap from a fresh macOS machine:

| Requirement | Why |
|---|---|
| `curl` | Ships with macOS — used to install Nix |
| **Nix** (with flakes) | Installs and manages everything else |

No Homebrew. No asdf. No manual tool installs.

## Bootstrap

### 1. Install Nix

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

This uses the [Determinate Nix Installer](https://github.com/DeterminateSystems/nix-installer), which enables flakes by default and supports macOS cleanly.

After install, restart your terminal (or `source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh`).

### 2. Clone this repository

```sh
git clone https://github.com/gedv/dotfiles ~/.config/dotfiles
cd ~/.config/dotfiles
```

### 3. Apply the configuration

```sh
nix run home-manager/master -- switch --flake .#gedv
```

On subsequent updates, use the helper script installed by the flake:

```sh
dotfiles-switch
```

## Daily use

| Command | Description |
|---|---|
| `dotfiles-switch` | Apply latest configuration changes |
| `ai-init <topic>` | Start an AI research loop, then open Zed |
| `direnv allow` | Activate a project-local Nix environment (`.envrc`) |

## Per-project environments

Add a `.envrc` to any project to pin its toolchain:

```sh
# .envrc
use flake "github:numtide/flake-utils#devShell.aarch64-darwin"
```

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it automatically when you `cd` into the directory.

## Adding tools

Edit `modules/terminal.nix` (or create a new module) and add the package to `home.packages`. Then run `dotfiles-switch`.

Search packages at [search.nixos.org](https://search.nixos.org/packages).
