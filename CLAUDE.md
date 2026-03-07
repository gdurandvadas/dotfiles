# Agent Instructions

This is a **Home Manager** dotfiles repository for macOS (Apple Silicon, `aarch64-darwin`). It uses **Nix Flakes** to declare a reproducible user environment across two profiles: `personal` and `work`.

---

## Repository Structure

```
.
├── flake.nix              # Entry point — defines personal and work profiles
├── default.nix            # Shared module imports (all profiles)
├── hosts/
│   ├── workstation.nix    # Personal profile host config
│   ├── work.nix           # Work profile host config
│   ├── local.nix          # GITIGNORED — machine identity (see below)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   ├── user.nix           # Defines options.my.user.* (identity contract)
│   ├── terminal.nix       # Shell, git, CLI tools
│   ├── zed.nix            # Zed editor + language servers
│   ├── opencode.nix       # OpenCode AI tool
│   ├── scripts.nix        # Custom shell scripts (dotfiles-switch, ai-init)
│   └── work.nix           # Work-profile overrides (git email, opencode config)
├── config/
│   ├── zed/               # Mutable Zed config (symlinked out-of-store)
│   └── opencode/          # OpenCode config per profile
└── docs/
    └── idea.md            # Architecture reference
```

---

## The `local.nix` Contract

**`hosts/local.nix` is gitignored and must never be committed.**

It holds machine-specific identity and is the only place personal information lives:

```nix
{ ... }: {
  my.user = {
    name           = "Your Name";
    email          = "you@personal.com";
    workEmail      = "you@company.com";
    username       = "yourusername";
    githubUsername = "yourgithub";
  };
}
```

**Rules for agents:**
- Never hardcode names, emails, usernames, or home directory paths in committed `.nix` files
- Always reference identity via `config.my.user.<field>` (defined in `modules/user.nix`)
- `home.homeDirectory` must be derived as `"/Users/${config.my.user.username}"`
- If a new module needs identity, import it from `config.my.user.*` — do not add new options without updating `local.nix.example` too

**Bootstrap on a new machine:**
```bash
cp hosts/local.nix.example hosts/local.nix
# edit hosts/local.nix with real values
```

---

## Profiles

| Profile | Flake key | Host file | Extra modules |
|---------|-----------|-----------|---------------|
| Personal | `personal` | `hosts/workstation.nix` | — |
| Work | `work` | `hosts/work.nix` | `modules/work.nix` |

The work profile overrides git `userEmail` with `my.user.workEmail` and points OpenCode to `config/opencode/work-config.json`.

---

## Applying Configuration

```bash
dotfiles-switch        # apply personal profile
dotfiles-switch work   # apply work profile

# or directly:
home-manager switch --flake .#personal
home-manager switch --flake .#work
```

---

## Adding a New Module

1. Create `modules/<name>.nix`
2. Add it to the `imports` list in `default.nix` (applies to all profiles), or import it only in a specific host file if profile-specific
3. Reference identity via `config.my.user.*`, never hardcode strings

---

## Security Rules

- No emails, usernames, tokens, API keys, or absolute paths in committed files
- `config/` files (zed, opencode) are symlinked out-of-store so tools can mutate them — they may contain non-sensitive config like themes or model names, but never credentials
- Secrets (API keys, tokens) belong in environment variables or a secrets manager, not in this repo
- `hosts/local.nix` is the only sanctioned location for personal identity values

---

## Key Patterns

**Out-of-store symlinks** (allows tools to mutate their own config):
```nix
xdg.configFile."zed/settings.json".source =
  config.lib.file.mkOutOfStoreSymlink
    "${config.home.homeDirectory}/.config/dotfiles/config/zed/settings.json";
```

**Work profile override** (force a value set by a base module):
```nix
programs.git.userEmail = lib.mkForce config.my.user.workEmail;
```

**Profile-specific config file** (different symlink target per profile):
```nix
xdg.configFile."opencode/config.json".source = lib.mkForce
  (config.lib.file.mkOutOfStoreSymlink
    "${config.home.homeDirectory}/.config/dotfiles/config/opencode/work-config.json");
```
