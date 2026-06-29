# Bootstrap (first-time install)

## Requirements

Bare minimum on macOS:

| Requirement | Why |
|---|---|
| `curl` | Ships with macOS — used to install Nix |
| **Nix** (with flakes) | Applies config and bootstraps nix-darwin |

Homebrew is installed by nix-darwin and then manages runtime packages.

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

Edit `hosts/local.nix` and fill in your name, email, username, and GitHub handle. This file is gitignored and never committed.

### 4. Apply

**Option A — Home Manager only** (no nix-darwin):

```sh
nix run .#apply
```

Use `--impure` when calling `home-manager` directly because `local.nix` is loaded from a path outside the store. The flake app (`nix run .#apply`) uses the flake's home-manager input so the version stays in one place.

**Option B — nix-darwin (workstation)**. One-time bootstrap (run from this repo):

```sh
export DOTFILES_DIR="$HOME/.config/dotfiles"   # or your clone path
nix run nix-darwin# -- switch --flake "$DOTFILES_DIR#workstation" --impure
```

After that, the flake installs the `dotfiles` CLI. For updates:

```sh
dotfiles apply
dotfiles workstation apply
```

`dotfiles` runs home-manager or darwin-rebuild as appropriate.
