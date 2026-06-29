# Daily use and extending the setup

## Daily use

| Command                        | Description                                         |
| ------------------------------ | --------------------------------------------------- |
| `dotfiles switch`              | Apply home-manager config                           |
| `dotfiles workstation rebuild` | Rebuild darwin workstation (darwin only)            |
| `nix run .#switch`             | Alternative: apply directly via flake               |
| `direnv allow`                 | Activate a project-local Nix environment (`.envrc`) |
| `z <project>`                  | Open a project in Zed                               |
| `c <project>`                  | Open a project in Cursor                            |
| `oc-pers [--copilot\|--claude]`| Launch OpenCode with personal config                |
| `oc-work [--copilot\|--bedrock\|--claude]` | Launch OpenCode with work config      |

## Per-project environments

Add a `.envrc` to any project to pin its toolchain:

```sh
# .envrc
use flake "github:numtide/flake-utils#devShell.aarch64-darwin"
```

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it when you `cd` into the directory.

## Adding tools

Edit the relevant `apps/*/module.nix` and add the package to `home.packages` (for example: `apps/tools/module.nix`, `apps/shell/module.nix`, or an app-specific module). Then run `dotfiles switch` or `dotfiles workstation rebuild`.

Search packages at [search.nixos.org](https://search.nixos.org/packages).

**Unfree packages:** If the package has an unfree license, add its Nix attribute name (e.g. `1password-cli`) to `unfree-packages.nix` under `base`, or under `darwinExtra` if it is only needed on nix-darwin (e.g. `1password-gui`).

## Adding a new module

1. Create `apps/<name>/module.nix`
2. Add it to the `imports` list in `default.nix`
3. Reference identity via `config.my.user.*` — never hardcode strings
4. Apply: `dotfiles switch` or `dotfiles workstation rebuild`
