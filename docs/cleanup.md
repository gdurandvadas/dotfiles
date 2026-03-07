# Chezmoi Cleanup Guide

This document explains how to remove all configuration and artifacts created by the old chezmoi-based dotfiles setup, in preparation for a clean Nix Home Manager environment.

> **Warning:** Most steps below are irreversible. Back up anything you want to keep before proceeding.

---

## 1. Remove Chezmoi State and Source

```bash
# Remove chezmoi itself and its internal state
chezmoi purge --binary

# Or manually:
rm -rf ~/.local/share/chezmoi     # chezmoi source directory (if not using this repo)
rm -rf ~/.config/chezmoi          # chezmoi config
```

---

## 2. Remove Shell Configuration

Chezmoi templated and placed these files directly:

```bash
rm -f ~/.zshrc
rm -rf ~/.zsh                     # Custom alias files: aw.zsh, gt.zsh, c.zsh, v.zsh
```

---

## 3. Remove Zsh Plugins

Chezmoi downloaded zsh plugins as external archives:

```bash
rm -rf ~/.local/share/chezmoi/dot_zsh/zsh-autosuggestions
rm -rf ~/.local/share/chezmoi/dot_zsh/zsh-syntax-highlighting
rm -rf ~/.local/share/chezmoi/dot_zsh/zsh-history-substring-search

# Also check if they landed in ~/.zsh:
rm -rf ~/.zsh/zsh-autosuggestions
rm -rf ~/.zsh/zsh-syntax-highlighting
rm -rf ~/.zsh/zsh-history-substring-search
```

---

## 4. Remove Git Configuration

```bash
rm -f ~/.gitconfig
```

---

## 5. Remove Terminal Emulator Config (Alacritty)

```bash
rm -rf ~/.config/alacritty
```

---

## 6. Remove Tmux Configuration

```bash
rm -rf ~/.config/tmux
rm -f ~/.tmux.conf                # If chezmoi placed it at the root
```

---

## 7. Remove Starship Configuration

```bash
rm -f ~/.config/starship.toml
```

---

## 8. Remove Editor Configurations

### VS Code

```bash
rm -f "$HOME/Library/Application Support/Code/User/settings.json"
rm -f "$HOME/Library/Application Support/Code/User/keybindings.json"
```

> Note: These may have been symlinked by chezmoi to `old/symlinks/`. Remove both the symlinks and the source files if no longer needed.

### Cursor

```bash
rm -f "$HOME/Library/Application Support/Cursor/User/settings.json"
rm -f "$HOME/Library/Application Support/Cursor/User/keybindings.json"
```

---

## 9. Remove asdf and Managed Language Runtimes

Chezmoi installed asdf and used it to manage: Go, Terraform, Flutter, Node.js, Python, Rust, Poetry.

```bash
# Remove asdf and all installed versions
rm -rf ~/.asdf

# Clean up shell integration leftovers
# (already removed with ~/.zshrc above)
```

---

## 10. Remove Homebrew Packages (Optional)

Only do this if you intend to fully reset Homebrew. The Nix setup does not require Homebrew, but some macOS system tools may still depend on it.

```bash
# Remove all casks installed by chezmoi
brew remove --cask --force alacritty cursor visual-studio-code docker brave-browser

# Remove all formulae installed by chezmoi
brew remove --force asdf buf ca-certificates jq mkdocs pulumi starship tmux tree yq

# Work-profile packages (if applicable)
brew remove --force act awscli helm helmfile k9s kubernetes-cli terraform-docs tflint tfsec yarn
```

To uninstall Homebrew entirely:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
```

---

## 11. Remove VS Code / Cursor Extensions (Optional)

```bash
# List installed extensions
code --list-extensions

# Remove each one
code --uninstall-extension <extension-id>
```

Extensions installed by chezmoi:
- `aaron-bond.better-comments`
- `bierner.markdown-mermaid`
- `davidanson.vscode-markdownlint`
- `file-icons.file-icons`
- `foxundermoon.shell-format`
- `golang.go`
- `hashicorp.terraform`
- `ms-azuretools.vscode-docker`
- `ms-kubernetes-tools.vscode-kubernetes-tools`
- `naumovs.color-highlight`
- `redhat.vscode-yaml`
- `rust-lang.rust-analyzer`
- `tamasfe.even-better-toml`
- `zxh404.vscode-proto3`

---

## 12. Final Sanity Check

After cleanup, verify no chezmoi-managed files remain:

```bash
chezmoi status        # Should show nothing or error (if chezmoi is removed)
ls ~/.zsh             # Should not exist
ls ~/.config/alacritty  # Should not exist
cat ~/.zshrc          # Should not exist
```

---

## What to Keep

Before deleting, consider preserving:

- `~/.aws/config` — AWS profiles (not managed by chezmoi, but used by `aw.zsh` aliases)
- `~/.ssh/` — SSH keys referenced in git config
- Any project-specific `.envrc` files (direnv)
- Personal data in `~/Development/`
