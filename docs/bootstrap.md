# Bootstrap (first-time install)

## Requirements

Bare minimum on macOS:

| Requirement | Why |
|---|---|
| `curl` | Ships with macOS — used to install Nix |
| **Nix** (with flakes) | Installs and manages everything else |

No Homebrew. No asdf. No manual tool installs.

## Steps

### 1. Install Nix

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

Uses the [Determinate Nix Installer](https://github.com/DeterminateSystems/nix-installer) (flakes enabled by default). After install, restart your terminal (or `source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh`).

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

**Option A — Makefile bootstrap (recommended for first-time)**. From the repo directory:

```sh
make bootstrap
```

This checks that Nix is installed, ensures `hosts/local.nix` exists (copies from example if not), ensures you are signed in to 1Password (prompts `op signin` if needed), then runs `nix run .#switch-personal`. After the first run, use the `dotfiles` CLI or make targets for updates.

**Option B — Home Manager only** (no nix-darwin). From the repo directory:

```sh
# Personal
nix run .#switch-personal

# Work
nix run .#switch-work
```

Use `--impure` when calling `home-manager` directly because `local.nix` is loaded from a path outside the store. The flake apps (`nix run .#switch-personal` / `.#switch-work`) use the flake’s home-manager input so the version stays in one place.

**Option C — nix-darwin (workstation)**. One-time bootstrap (run from this repo):

```sh
export DOTFILES_DIR="$HOME/.config/dotfiles"   # or your clone path
nix run nix-darwin# -- switch --flake "$DOTFILES_DIR#workstation" --impure
```

After that, the flake installs the `dotfiles` CLI. For updates:

```sh
dotfiles profile personal
dotfiles profile work
dotfiles workstation rebuild
```

`dotfiles` runs home-manager or darwin-rebuild as appropriate.
