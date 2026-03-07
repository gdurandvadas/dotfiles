# Chezmoi → Nix Migration Guide

This document tracks what existed in the old chezmoi setup, what has already been migrated to the Nix Home Manager configuration, and what still needs to be ported.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Migrated — covered by the Nix setup |
| 🔄 | Partial — exists in Nix but incomplete |
| ❌ | Not yet migrated |
| 🗑️ | Intentionally dropped (replaced or no longer needed) |

---

## Identity & Secrets

| Item | Old (Chezmoi) | Nix Equivalent | Status |
|------|---------------|----------------|--------|
| Full name | `.chezmoi.toml.tmpl` prompt | `hosts/local.nix` → `my.user.name` | ✅ |
| Personal email | `.chezmoi.toml.tmpl` prompt | `hosts/local.nix` → `my.user.email` | ✅ |
| Work email | `workspace=work` branch | `hosts/local.nix` → `my.user.workEmail` | ✅ |
| Username | Inferred from `$HOME` | `hosts/local.nix` → `my.user.username` | ✅ |
| SSH signing key | `.chezmoi.toml.tmpl` prompt | Set in `modules/terminal.nix` via `programs.git` | 🔄 |

**Action needed:** SSH commit signing (`gpg.format = ssh`, `gpg.ssh.program`, `commit.gpgsign`) is not yet configured in `modules/terminal.nix`. Add:

```nix
programs.git = {
  signing = {
    key = "~/.ssh/id_ed25519.pub";  # or read from config.my.user
    signByDefault = true;
  };
  extraConfig = {
    gpg.format = "ssh";
    "gpg \"ssh\"".program = "/Applications/1Password.app/Contents/MacOS/op-ssh-sign";
    fetch.prune = true;
    fetch.pruneTags = true;
    pull.rebase = true;
  };
};
```

---

## Shell

| Item | Old (Chezmoi) | Nix Equivalent | Status |
|------|---------------|----------------|--------|
| Zsh setup | `dot_zshrc.tmpl` | `modules/terminal.nix` → `programs.zsh` | ✅ |
| Autosuggestions | External archive via `.chezmoiexternal.toml` | `programs.zsh.autosuggestion.enable` | ✅ |
| Syntax highlighting | External archive | `programs.zsh.syntaxHighlighting.enable` | ✅ |
| History substring search | External archive | Not enabled | ❌ |
| Homebrew PATH | `dot_zshrc.tmpl` | Managed by Nix/Home Manager | ✅ |
| Java PATH (`openjdk@17`) | `dot_zshrc.tmpl` | Not configured | ❌ |
| `~/.local/bin` on PATH | `dot_zshrc.tmpl` | Not configured | ❌ |

**Action needed:**
- Enable `programs.zsh.historySubstringSearch.enable = true` in `modules/terminal.nix`
- Add `~/.local/bin` to `home.sessionPath` if still needed
- Java PATH only needed if Java tooling is added; defer until required

---

## Shell Aliases & Functions

These lived in `old/private_dot_zsh/` and are currently sourced via a glob (`for f in $HOME/.zsh/*.zsh`), but the files themselves are not managed by Nix.

| File | Purpose | Status |
|------|---------|--------|
| `aw.zsh` | AWS SSO login, profile switcher, region setter | ❌ |
| `gt.zsh` | Conventional commit helper, branch cleanup | ❌ |
| `c.zsh` | Cursor IDE launcher (`c [group] [dir]`) | ❌ |
| `v.zsh` | VS Code launcher (`v [group] [dir]`) | ❌ |

**Action needed:** Port these as Nix-managed shell scripts. Two options:

**Option A — `programs.zsh.shellAliases` + inline functions** (simple):
```nix
programs.zsh.initExtra = ''
  # paste function body here
'';
```

**Option B — `pkgs.writeShellScriptBin` in `modules/scripts.nix`** (cleaner, adds to PATH as binaries):
```nix
let
  gt = pkgs.writeShellScriptBin "gt" ''...script content...'';
in {
  home.packages = [ gt ];
}
```

The `aw.zsh` aliases are work-specific; add them to `modules/work.nix`.

---

## Git

| Item | Old (Chezmoi) | Nix Equivalent | Status |
|------|---------------|----------------|--------|
| `user.name` | `dot_gitconfig.tmpl` templated | `modules/terminal.nix` | ✅ |
| `user.email` (personal) | `dot_gitconfig.tmpl` templated | `modules/terminal.nix` | ✅ |
| `user.email` (work) | `workspace=work` branch | `modules/work.nix` with `lib.mkForce` | ✅ |
| `pull.rebase = true` | `dot_gitconfig.tmpl` | `modules/terminal.nix` | ✅ |
| `fetch.prune = true` | `dot_gitconfig.tmpl` | `modules/terminal.nix` | ✅ |
| `fetch.pruneTags = true` | `dot_gitconfig.tmpl` | `modules/terminal.nix` | ✅ |
| SSH commit signing (1Password) | `dot_gitconfig.tmpl` | `modules/terminal.nix` | ✅ |

See the **Identity** section above for the full `programs.git` block to add.

---

## Terminal Emulator (Alacritty)

Alacritty was fully configured by chezmoi under `private_dot_config/alacritty/`.

| Item | Status | Notes |
|------|--------|-------|
| Main config (`alacritty.toml`) | ✅ | `programs.alacritty` in `modules/terminal.nix` |
| Gruvbox dark theme | ✅ | Inline in `programs.alacritty.settings.colors` |
| Keybindings (`keybindings.toml`) | ✅ | `config/alacritty/keybindings.toml` via `xdg.configFile` |
| Shell launch into tmux | 🗑️ | Skipped — tmux not yet migrated |

**Action needed:** Either:
- Add `programs.alacritty` in `modules/terminal.nix` using Home Manager's Alacritty module, or
- Add `alacritty` to `home.packages` and place config files via `xdg.configFile` using out-of-store symlinks (like Zed)

The old config files are in `old/private_dot_config/alacritty/` and can be copied to `config/alacritty/`.

---

## Terminal Multiplexer (Tmux)

| Item | Status | Notes |
|------|--------|-------|
| Prefix `Ctrl+A` | ❌ | |
| Vim-style pane navigation | ❌ | `h/j/k/l` |
| Window selection `1-9,0` | ❌ | |
| Pane synchronization toggle | ❌ | `g` key |
| History limit 100k | ❌ | |
| Mouse support | ❌ | |
| Gruvbox statusbar | ❌ | |

**Action needed:** Add `programs.tmux` to `modules/terminal.nix`:

```nix
programs.tmux = {
  enable = true;
  # ... or point to config/tmux/tmux.conf via extraConfig
};
```

The existing config is at `old/private_dot_config/tmux/tmux.conf`.

---

## Shell Prompt (Starship)

| Item | Old (Chezmoi) | Nix Equivalent | Status |
|------|---------------|----------------|--------|
| Starship enabled | `run_onchange_brew.sh` installs it | `modules/terminal.nix` → `programs.starship.enable` | ✅ |
| Custom config (`starship.toml`) | `private_dot_config/starship.toml` | `programs.starship.settings` — catppuccin-powerline mocha | ✅ |

**Action needed:** The old `starship.toml` has a full gruvbox-dark palette with AWS, Kubernetes, and language segments. Port it via:

```nix
programs.starship = {
  enable = true;
  settings = { /* inline TOML as Nix attrset */ };
};
```

Or place the file at `config/starship/starship.toml` and symlink it via `xdg.configFile`.

---

## Packages

### CLI Tools

| Package | Old | Nix | Status |
|---------|-----|-----|--------|
| `jq` | Homebrew | `modules/terminal.nix` | ✅ |
| `ripgrep` | — | `modules/terminal.nix` | ✅ |
| `fzf` | — | `modules/terminal.nix` | ✅ |
| `fd` | — | `modules/terminal.nix` | ✅ |
| `bat` | — | `modules/terminal.nix` | ✅ |
| `eza` | — | `modules/terminal.nix` | ✅ |
| `gh` | — | `modules/terminal.nix` | ✅ |
| `tree` | Homebrew | Not in Nix | ❌ |
| `yq` | Homebrew | Not in Nix | ❌ |
| `buf` | Homebrew | Not in Nix | ❌ |
| `tmux` | Homebrew | Managed via `programs.tmux` | 🔄 |
| `starship` | Homebrew | Managed via `programs.starship` | ✅ |
| `pulumi` | Homebrew | Not in Nix | ❌ |

### Work-Only Tools

| Package | Status |
|---------|--------|
| `awscli` | ❌ |
| `helm` | ❌ |
| `helmfile` | ❌ |
| `k9s` | ❌ |
| `kubernetes-cli` (`kubectl`) | ❌ |
| `terraform-docs` | ❌ |
| `tflint` | ❌ |
| `tfsec` | ❌ |
| `yarn` | ❌ |
| `act` (local GitHub Actions) | ❌ |

**Action needed:** Add missing tools to `home.packages` in the appropriate module. Work-specific tools belong in `modules/work.nix`.

### Language Runtimes

The old setup used `asdf` to manage runtimes. The Nix approach uses `home.packages` (pinned versions) or per-project `direnv` + `.envrc`.

| Runtime | Old Version | Nix Status |
|---------|-------------|------------|
| Go | 1.23.2 | ❌ |
| Node.js | 22.9.0 | ❌ |
| Python | 3.13.1 | ❌ |
| Rust | 1.81.0 | ❌ |
| Terraform | 1.9.8 | ❌ |
| Flutter | 3.27.3 | ❌ |
| Poetry | 2.0.1 | ❌ |

**Recommendation:** Rather than installing global runtimes (old asdf pattern), use `direnv` with per-project `.envrc` files (`use flake` or `use nix`). This is already configured via `programs.direnv.nix-direnv.enable = true`. Add only runtimes you want globally available to `home.packages`.

---

## Editor

| Item | Old (Chezmoi) | Nix Equivalent | Status |
|------|---------------|----------------|--------|
| VS Code config | `symlinks/settings.json` | Dropped — replaced by Zed | 🗑️ |
| VS Code extensions | `run_onchange_ides.sh` | Dropped — replaced by Zed | 🗑️ |
| Zed config | Not present | `modules/zed.nix` + `config/zed/` | ✅ |

---

## Applications (Casks)

These were installed via Homebrew casks. Nix/Home Manager does not manage macOS `.app` bundles directly — use `homebrew.casks` via `nix-homebrew` or install manually.

| App | Status |
|-----|--------|
| Alacritty | ❌ (manage via `home.packages` with `pkgs.alacritty` or cask) |
| Cursor | ❌ (install manually or via cask) |
| Docker Desktop | ❌ (install manually or via cask) |
| Brave Browser | ❌ (install manually or via cask) |

---

## Migration Priority

Suggested order based on impact:

1. **Git config** — Add signing, rebase, and prune settings to `modules/terminal.nix`
2. **Tmux** — Enable `programs.tmux` with existing config
3. **Starship config** — Port `starship.toml` into `programs.starship.settings`
4. **Shell aliases** — Port `gt.zsh` and `c.zsh` into `modules/scripts.nix`
5. **Work packages** — Add work CLI tools to `modules/work.nix`
6. **AWS aliases** — Port `aw.zsh` into `modules/work.nix`
7. **CLI tools** — Add `tree`, `yq`, `buf`, `pulumi` to `modules/terminal.nix`
8. **Alacritty** — Add config via `xdg.configFile` or `programs.alacritty`
9. **Language runtimes** — Decide global vs. per-project via direnv
