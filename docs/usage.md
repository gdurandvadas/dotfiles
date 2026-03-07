# Daily use and extending the setup

## Daily use

| Command | Description |
|---|---|
| `dotfiles-switch` | Apply latest personal configuration (darwin only) |
| `dotfiles-switch work` | Apply latest work configuration (darwin only) |
| `nix run .#switch-personal` / `nix run .#switch-work` | Apply profile when using Home Manager only |
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

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it when you `cd` into the directory.

## Adding tools

Edit `modules/terminal.nix` or `modules/tools.nix` (or create a new module) and add the package to `home.packages`. Then run `dotfiles-switch` (darwin) or `nix run .#switch-personal` / `nix run .#switch-work` (home-manager only).

Search packages at [search.nixos.org](https://search.nixos.org/packages).

**Unfree packages:** If the package has an unfree license, add its Nix attribute name (e.g. `1password-cli`) to `unfree-packages.nix` under `base`, or under `darwinExtra` if it is only needed on nix-darwin (e.g. `1password-gui`).

## Adding a new module

1. Create `modules/<name>.nix`
2. Add it to the `imports` list in `default.nix` (all profiles), or only in a specific host file if profile-specific
3. Reference identity via `config.my.user.*` — never hardcode strings
4. Apply: `dotfiles-switch` (darwin) or `nix run .#switch-personal` / `nix run .#switch-work` (home-manager only)
