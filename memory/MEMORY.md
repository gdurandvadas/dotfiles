# dotfiles project memory

## Overview
Nix Flakes + Home Manager + OpenCode AI-orchestrated dotfiles for macOS (aarch64-darwin).
No Homebrew. No asdf. Nix manages everything.

## Key facts
- User: gedv, Apple Silicon Mac (aarch64-darwin)
- Repo cloned to: ~/.config/dotfiles
- Old chezmoi setup lives in `old/` — ignore for now, will cherry-pick configs later
- Nix not yet installed on the machine

## Architecture
- `flake.nix` — pins nixpkgs + home-manager
- `default.nix` — aggregates all modules
- `hosts/workstation.nix` — machine identity
- `modules/` — zed, opencode, terminal, scripts
- `config/` — mutable config files (symlinked out-of-store via mkOutOfStoreSymlink)

## Bootstrap sequence
1. Install Nix via Determinate Installer (enables flakes by default)
2. `git clone` repo to `~/.config/dotfiles`
3. `nix run home-manager/master -- switch --flake .#gedv`

## Notes on zed.nix
- Uses `mkOutOfStoreSymlink` pointing to `~/.config/dotfiles/config/zed/` so Zed can mutate its own settings
- Same pattern for opencode config

## Next steps (deferred)
- Cherry-pick configs from `old/` chezmoi setup (gitconfig, zshrc, alacritty, starship, tmux, custom zsh functions)
- Add per-project devShell examples
- Consider nix-darwin for system-level settings (dock, keyboard, etc.)
