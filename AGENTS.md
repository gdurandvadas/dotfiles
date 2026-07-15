# Agent Instructions

This is a **Home Manager** dotfiles repository for macOS (Apple Silicon, `aarch64-darwin`). It uses **Nix Flakes** to declare a reproducible user environment.

---

## Repository Structure

```text
.
├── Makefile               # Bootstrap and switch targets
├── flake.nix              # Entry point — defines the personal profile
├── default.nix            # Shared module imports
├── unfree-packages.nix    # Single source of unfree package names (base + darwinExtra)
├── hosts/
│   ├── personal.nix       # Host config
│   ├── darwin.nix         # nix-darwin system config (workstation flake)
│   ├── local.nix          # GITIGNORED — machine identity (see below)
│   └── local.nix.example  # Template for local.nix
├── modules/
│   └── user.nix           # Defines options.my.user.* (identity contract)
├── apps/
│   ├── shell/
│   │   └── module.nix     # Zsh, direnv, git, shell defaults, baseline CLI utilities
│   ├── tools/
│   │   └── module.nix     # Unfree/extra tools (1Password CLI, Brave, gh, claude-code, etc.)
│   ├── opencode/
│   │   ├── module.nix     # OpenCode package + Home Manager wiring
│   │   ├── config.jsonc   # Personal OpenCode configuration
│   │   ├── agents/        # Personal primary and subagent prompts
│   │   ├── commands/      # Personal task commands
│   │   ├── lib/           # Deterministic task state machine
│   │   ├── plugins/       # Personal task command integration
│   │   └── tools/         # Personal task tools
│   ├── claude/
│   │   ├── module.nix     # Claude Code Home Manager wiring
│   │   ├── CLAUDE.md      # Work ADE instructions
│   │   ├── agents/        # Work task subagents
│   │   ├── commands/      # Work task slash commands
│   │   ├── mcp/           # Local task MCP server
│   │   └── mcp.json       # Env-configured MCP servers
│   ├── scripts/
│   │   ├── module.nix     # Custom scripts as Nix packages
│   │   ├── dotfiles.sh    # Unified home-manager / darwin switch script
│   │   ├── cl.sh          # Launch Claude Code with work MCP configuration
│   │   ├── oc-pers.sh     # Launch OpenCode with personal config
│   │   ├── z.sh           # Open project in Zed
│   │   ├── c.sh           # Open project in Cursor
│   │   └── *.zsh          # Zsh helper scripts sourced at shell startup
│   ├── zed/
│   │   ├── module.nix     # Zed editor + language servers
│   │   └── *.json         # Mutable Zed settings and keymap
│   ├── alacritty/
│   │   ├── module.nix     # Alacritty app wiring and theme links
│   │   └── *.toml         # Mutable Alacritty config and themes
│   ├── zellij/
│   │   ├── module.nix     # Zellij package + config links
│   │   └── *.kdl          # Mutable Zellij config/layout
│   ├── starship/
│   │   ├── module.nix     # Starship wiring and theme links
│   │   └── *.toml         # Starship theme files
│   └── mise/
│       ├── module.nix     # Mise package + config link
│       └── config.toml
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
    username       = "yourusername";
    githubUsername = "yourgithub";
    sshSigningKey  = "ssh-ed25519 ...";
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

## Build, Lint, and Test Commands

This is a **Nix Flakes** project using **Home Manager**. There are no traditional tests, but you can validate and build the configuration.

### Validate Configuration

```bash
# Dry-run validation (check for syntax errors)
nix eval .#homeConfigurations.personal.pkgs --apply 'x: x.outPath' 2>&1 | head -5

# Or use home-manager's dry-run (more thorough)
home-manager dry-activate --flake .#personal
```

### Apply Configuration

```bash
dotfiles apply
home-manager switch --flake .#personal
```

### Nix Formatting and Linting

```bash
nix fmt

nix eval .#homeConfigurations.personal.config.system.buildHomeGenerationPath --apply 'x: x' 2>&1 | head -20
```

---

## Code Style Guidelines

This is a declarative **Nix / NixOS** configuration repository using Home Manager. Follow these conventions:

### General Principles

- Use **declarative configuration** over imperative scripts
- Prefer **module composition** (imports) over duplication
- Keep files focused: one logical concern per file

### Nix Language Conventions

**Formatting:**

- 2-space indentation
- Align attributes within attribute sets when it improves readability
- Maximum line length: 100 characters (soft limit)

**Imports:**

- Use `./relative/path` for local module imports
- Put imports at the top of files

**Types:**

- Always declare option types: `type = types.str`, `type = types.listOf types.str`, etc.
- Provide sensible defaults with `default = ...;`
- Add `description = "...";` for every option

**Naming:**

- Use `snake_case` for variable and option names
- Use `PascalCase` for Nix library functions
- Prefix boolean options with `enable` or `disable`

**Pattern Examples:**

```nix
# Out-of-store symlink (allows tools to mutate their own config)
xdg.configFile."zed/settings.json".source =
  config.lib.file.mkOutOfStoreSymlink
    "${config.home.homeDirectory}/.config/dotfiles/apps/zed/settings.json";

# Conditional config
home.packages = lib.mkIf config.my.enableTools (with pkgs; [ foo bar ]);
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
- `apps/` files are symlinked out-of-store when tools need mutable config — they may contain non-sensitive config like themes or model names, but never credentials
- Secrets (API keys, tokens) belong in environment variables or a secrets manager (e.g. 1Password CLI); see [docs/secrets-1password.md](docs/secrets-1password.md)
- `hosts/local.nix` is the only sanctioned location for personal identity values
