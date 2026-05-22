# Daily use and extending the setup

## Daily use

| Command                                               | Description                                         |
| ----------------------------------------------------- | --------------------------------------------------- |
| `dotfiles profile personal`                           | Switch to personal profile (home-manager)           |
| `dotfiles profile work`                               | Switch to work profile (home-manager)               |
| `dotfiles workstation rebuild`                        | Rebuild darwin workstation (darwin only)            |
| `nix run .#switch-personal` / `nix run .#switch-work` | Alternative: apply profile directly via flake       |
| `direnv allow`                                        | Activate a project-local Nix environment (`.envrc`) |
| `pi`                                                  | Start the pinned Pi coding agent                    |
| `pi-init`                                             | Initialize or update `.pi/` in the current project  |

## Profiles

| Profile  | Flake key  | Git identity        |
| -------- | ---------- | ------------------- |
| Personal | `personal` | `my.user.email`     |
| Work     | `work`     | `my.user.workEmail` |

Both profiles share the same tools (Zed and the CLI stack). The work profile only overrides git email.

## Pi

Pi is installed through the pinned `pkgs.pi-coding-agent` package. Global mutable
settings live in `apps/pi/config/` and are linked to `~/.pi/agent/` by Home
Manager. Project-local Pi extensions, skills, and memory placeholders live in
`apps/pi/project/`; root `.pi/` is only a discovery shim.

### Initialize a project

From any project directory:

```sh
pi-init
```

This syncs `apps/pi/project/` into the current project's `.pi/` directory.
If `.pi/` already exists, `pi-init` prompts before overwrite.

Useful flags:

```sh
pi-init --dry-run
pi-init --force
```

Version tracking:

- Template version: `.pi/VERSION`
- Template changelog: `.pi/CHANGELOG.md`

When you update dotfiles, run `pi-init` again in projects to move them to the
new template version.

## Per-project environments

Add a `.envrc` to any project to pin its toolchain:

```sh
# .envrc
use flake "github:numtide/flake-utils#devShell.aarch64-darwin"
```

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it when you `cd` into the directory.

## Adding tools

Edit the relevant `apps/*/module.nix` and add the package to `home.packages` (for example: `apps/tools/module.nix`, `apps/shell/module.nix`, or an app-specific module). Then run `dotfiles-switch` or `dotfiles workstation rebuild` (darwin) or `dotfiles profile personal` / `dotfiles profile work` (home-manager).

Search packages at [search.nixos.org](https://search.nixos.org/packages).

**Unfree packages:** If the package has an unfree license, add its Nix attribute name (e.g. `1password-cli`) to `unfree-packages.nix` under `base`, or under `darwinExtra` if it is only needed on nix-darwin (e.g. `1password-gui`).

## Adding a new module

1. For app-specific behavior, create `apps/<name>/module.nix`
2. Add it to the `imports` list in `default.nix` (all profiles), or only in a specific host file if profile-specific
3. Reference identity via `config.my.user.*` — never hardcode strings
4. Apply: `dotfiles-switch` or `dotfiles workstation rebuild` (darwin) or `dotfiles profile personal` / `dotfiles profile work` (home-manager)
