# Agent Instructions

This is a **Home Manager** dotfiles repository for macOS (Apple Silicon, `aarch64-darwin`). It uses **Nix Flakes** to declare a reproducible user environment across two profiles: `personal` and `work`.

---

## Repository Structure

```
.
├── flake.nix              # Entry point — defines personal and work profiles
├── default.nix            # Shared module imports (all profiles)
├── hosts/
│   ├── personal.nix       # Personal profile host config
│   ├── work.nix           # Work profile host config
│   ├── darwin.nix         # nix-darwin system config (workstation flake)
│   ├── local.nix          # GITIGNORED — machine identity (see below)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   ├── user.nix           # Defines options.my.user.* (identity contract)
│   ├── terminal.nix       # Shell, git, CLI tools
│   ├── zed.nix            # Zed editor + language servers
│   ├── opencode.nix       # OpenCode AI tool
│   ├── scripts.nix        # Custom shell scripts (dotfiles-switch, ai-init)
│   ├── tools.nix          # Unfree CLI tools (1Password, Brave, mise, gh)
│   └── work.nix           # Work-profile overrides (git email, opencode config)
├── config/
│   ├── zed/               # Mutable Zed config (symlinked out-of-store)
│   └── opencode/          # OpenCode config per profile
└── docs/
    └── secrets-1password.md # 1Password CLI usage for secrets (no secrets in repo/store)
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
| Personal | `personal` | `hosts/personal.nix` | — |
| Work | `work` | `hosts/work.nix` | `modules/work.nix` |

The work profile overrides git `userEmail` with `my.user.workEmail` and points OpenCode to `config/opencode/work-config.json`.

---

## Build, Lint, and Test Commands

This is a **Nix Flakes** project using **Home Manager**. There are no traditional tests, but you can validate and build the configuration.

### Validate Configuration

```bash
# Dry-run validation (check for syntax errors)
nix eval .#homeConfigurations.personal.pkgs --apply 'x: x.outPath' 2>&1 | head -5
nix eval .#homeConfigurations.work.pkgs --apply 'x: x.outPath' 2>&1 | head -5

# Or use home-manager's dry-run (more thorough)
home-manager dry-activate --flake .#personal
home-manager dry-activate --flake .#work
```

### Apply Configuration

```bash
# Personal profile (default)
dotfiles-switch
home-manager switch --flake .#personal

# Work profile
dotfiles-switch work
home-manager switch --flake .#work
```

### Nix Formatting and Linting

```bash
# Format Nix files (installed via nix fmt or nix run nixfmt --)
nix fmt

# Check Nix syntax and evaluate flake (validates all modules)
nix build .#packages.aarch64-darwin.dummy --show-trace || true

# Evaluate a specific configuration to catch errors early
nix eval .#homeConfigurations.personal.config.system.buildHomeGenerationPath --apply 'x: x' 2>&1 | head -20
```

### Useful Debug Commands

```bash
# Show all options for a module
home-manager option -m home.packages

# List generated files without applying
home-manager generations

# Check what packages would be installed
nix profile list --flake .#personal
```

---

## Code Style Guidelines

This is a declarative **Nix/ NixOS** configuration repository using Home Manager. Follow these conventions:

### General Principles

- Use **declarative configuration** over imperative scripts
- Prefer **module composition** (imports) over duplication
- Keep files focused: one logical concern per file
- Use descriptive names for options and variables

### Nix Language Conventions

**Formatting:**
- 2-space indentation
- Align attributes within attribute sets when it improves readability
- Use trailing commas in attribute sets and lists (Nix style)
- Maximum line length: 100 characters (soft limit)

**Imports:**
- Use `./relative/path` for local module imports
- Put imports at the top of files
- Group imports logically (stdlib first, then local modules)

**Types:**
- Always declare option types: `type = types.str`, `type = types.listOf types.str`, etc.
- Use `types.str`, `types.int`, `types.bool`, `types.path`, `types.listOf`, `types.attrsOf`
- Provide sensible defaults with `default = ...;`
- Add `description = "...";` for every option

**Naming:**
- Use `snake_case` for variable and option names (e.g., `home.packages`, `enableZshIntegration`)
- Use `PascalCase` for Nix library functions (e.g., `lib.mkOption`, `lib.mkIf`)
- Prefix boolean options with `enable` or `disable` (e.g., `enable`, `enableCompletion`)

**Error Handling:**
- Use `lib.mkIf` for conditional config (evaluates to Nix `null` if false)
- Use `lib.mkWhen` for platform-specific config
- Use `lib.mkForce` to override values set by imported modules
- Use `lib.mkDefault` to provide a default that users can override
- Use `lib.optional` / `lib.optionalString` for conditional inclusion

**Pattern Examples:**

```nix
# Option with type and description
my.option.name = mkOption {
  type = types.str;
  description = "Description of what this option does.";
  example = "example-value";
};

# Conditional config
home.packages = lib.mkIf config.my.enableTools (with pkgs; [ foo bar ]);

# Platform-specific
programs.zsh.enable = lib.mkIf stdenv.isDarwin true;

# Override in work profile
programs.git.userEmail = lib.mkForce config.my.user.workEmail;
```

### Module Structure Template

```nix
{ config, lib, pkgs, ... }:
let inherit (lib) mkOption types mkIf; in
{
  options.my.feature = {
    enable = mkOption {
      type = types.bool;
      default = false;
      description = "Enable feature X";
    };
  };

  config = mkIf config.my.feature.enable {
    home.packages = with pkgs; [ example ];
  };
}
```

---

## Security Rules

- No emails, usernames, tokens, API keys, or absolute paths in committed files
- `config/` files (zed, opencode) are symlinked out-of-store so tools can mutate them — they may contain non-sensitive config like themes or model names, but never credentials
- Secrets (API keys, tokens) belong in environment variables or a secrets manager (e.g. 1Password CLI); see [docs/secrets-1password.md](docs/secrets-1password.md)
- Home Manager config and the Nix store must not contain secrets; use 1Password + `op run` / wrapper scripts
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

---

## Editor Setup

For VS Code / Zed / OpenCode, add this to enable Nix language support:

- **Zed**: Built-in Nix support via tree-sitter
- **VS Code**: Install `Nix IDE` or `Nix language server` extension
- **OpenCode**: Uses Zed's language server internally

Configure your editor to use `nixfmt` for formatting on save.
