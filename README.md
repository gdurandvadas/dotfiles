# dotfiles

Deterministic, AI-orchestrated development environment for a polyglot stack (Go, Rust, TypeScript, SQL).

Powered by **Nix Flakes** + **Home Manager** + **OpenCode**.

## Structure

```
.
├── flake.nix              # Entry point — pins all dependencies
├── default.nix            # Aggregates all modules
├── hosts/
│   ├── personal.nix       # Personal profile host config
│   ├── work.nix           # Work profile host config
│   ├── darwin.nix         # Optional nix-darwin system config (workstation flake)
│   ├── local.nix          # GITIGNORED — your identity (copy from example)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   ├── user.nix           # Defines options.my.user.* (identity contract)
│   ├── zed.nix            # Zed editor + language servers
│   ├── opencode.nix       # OpenCode AI orchestrator
│   ├── terminal.nix       # Zsh, Starship, direnv, git, CLI tools
│   ├── scripts.nix        # Custom scripts as Nix packages
│   └── work.nix           # Work profile overrides (git email, opencode config)
└── config/
    ├── zed/
    │   ├── settings.json     # Zed behavior, LSP config, theme
    │   └── keymap.json       # Custom keybindings
    └── opencode/
        ├── config.json       # Personal OpenCode model + MCP servers
        ├── work-config.json  # Work OpenCode config
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

### 3. Create your local identity file

```sh
cp hosts/local.nix.example hosts/local.nix
```

Edit `hosts/local.nix` and fill in your name, emails, username, and GitHub handle. This file is gitignored and never committed.

### 4. Apply a profile

There are two ways to use these dotfiles:

**Option A — Home Manager only** (no nix-darwin). Apply with:

```sh
# Personal
home-manager switch --flake .#personal
# or without home-manager installed: nix run home-manager# -- switch --flake .#personal

# Work
home-manager switch --flake .#work
```

Use the same commands for subsequent updates.

**Option B — nix-darwin (workstation)**. One-time bootstrap (run from this repo; requires `--impure` because of `local.nix` path):

```sh
export DOTFILES_DIR="$HOME/.config/dotfiles"   # or your clone path
nix run nix-darwin# -- switch --flake "$DOTFILES_DIR#workstation" --impure
```

After that, the flake installs a helper script. For updates:

```sh
dotfiles-switch         # personal profile (darwin + home-manager)
dotfiles-switch work    # work profile
```

`dotfiles-switch` runs `darwin-rebuild` and applies both system and home-manager config; it is only for the darwin workflow.

## Daily use

| Command | Description |
|---|---|
| `dotfiles-switch` | Apply latest personal configuration |
| `dotfiles-switch work` | Apply latest work configuration |
| `ai-init <topic>` | Start an AI research loop, then open Zed |
| `direnv allow` | Activate a project-local Nix environment (`.envrc`) |

## Profiles

| Profile | Flake key | Git identity | OpenCode config |
|---|---|---|---|
| Personal | `personal` | `my.user.email` | `config/opencode/config.json` |
| Work | `work` | `my.user.workEmail` | `config/opencode/work-config.json` |

Both profiles share the same tools (Zed, OpenCode, CLI stack). The work profile only overrides git email and OpenCode settings.

## Per-project environments

Add a `.envrc` to any project to pin its toolchain:

```sh
# .envrc
use flake "github:numtide/flake-utils#devShell.aarch64-darwin"
```

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it automatically when you `cd` into the directory.

## Adding tools

Edit `modules/terminal.nix` (or create a new module) and add the package to `home.packages`. Then run `dotfiles-switch` (darwin) or `home-manager switch --flake .#<profile>` (home-manager only).

Search packages at [search.nixos.org](https://search.nixos.org/packages).

## Adding a new module

1. Create `modules/<name>.nix`
2. Add it to the `imports` list in `default.nix` (all profiles), or only in a specific host file if profile-specific
3. Reference identity via `config.my.user.*` — never hardcode strings
4. Apply: `dotfiles-switch` (darwin) or `home-manager switch --flake .#<profile>` (home-manager only)

## Secrets (1Password)

API keys, tokens, and passwords are not stored in this repo. Git SSH signing uses 1Password (`op-ssh-sign`). For other secrets, use 1Password CLI and inject at runtime. See [docs/secrets-1password.md](docs/secrets-1password.md).
