# Daily use and extending the setup

## Mental model

| Layer | Tool | Manages |
| ----- | ---- | ------- |
| Binaries & apps | **Homebrew** | CLIs, GUI apps, casks, fonts |
| Language runtimes | **mise** | Node, Go, Rust, Python, etc. |
| Config files | **Home Manager / Nix** | dotfiles, symlinks, `.zshrc`, git config |
| System defaults | **nix-darwin** | macOS settings, Homebrew orchestration |

Nix never installs a runtime binary. Homebrew never writes a config file.

## Daily use

| Command                                    | Description                                                           |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `dotfiles workstation apply`               | Apply everything: brew installs/upgrades + Home Manager config        |
| `dotfiles apply`                           | Apply Home Manager config only (no brew changes)                      |
| `dotfiles update [--darwin]`               | Update flake inputs, then apply; `--darwin` also runs darwin-rebuild  |
| `direnv allow`                             | Activate a project-local Nix dev environment (`.envrc`)               |
| `z <project>`                              | Open a project in Zed                                                 |
| `c <project>`                              | Open a project in Cursor                                              |
| `oc-pers`                                  | Launch OpenCode with personal configuration                           |
| `cl`                                       | Launch Claude Code with the work ADE and configured MCP servers       |

> **When to use which apply command:**
> - `dotfiles workstation apply` — canonical. Installs/upgrades brew packages AND applies config. Use this after adding a new brew package.
> - `dotfiles apply` — config files only. No brew interaction. Use this for quick config edits.

## Per-project environments

Add a `.envrc` to any project to pin its toolchain:

```sh
# .envrc — picks up a project flake.nix devShell automatically
use flake
```

Or write a `flake.nix` in the project root with a `devShell` output. `direnv` will activate it on `cd`.

## Adding packages

Edit `hosts/darwin.nix` and add the formula or cask to the `homebrew.brews` or `homebrew.casks` list. Then run:

```sh
dotfiles workstation apply
```

- Formulas (CLIs): `homebrew.brews = [ ... "my-tool" ... ]`
- GUI apps / casks: `homebrew.casks = [ ... "my-app" ... ]`
- New tap needed: add to `homebrew.taps = [ ... "vendor/tap" ... ]`

Search packages at [formulae.brew.sh](https://formulae.brew.sh).

## Adding language runtimes

Use `mise` — edit `apps/mise/config.toml` and run `mise install`. No rebuild needed.

## Adding config-only modules (Nix)

1. Create `apps/<name>/module.nix`
2. Add it to the `imports` list in `default.nix`
3. Reference identity via `config.my.user.*` — never hardcode strings
4. Apply: `dotfiles apply`

## Notes on specific packages

- **dioxus-cli (`dx`):** No brew formula yet. Install with `curl -fsSL https://dioxuslabs.com/install.sh | bash` or `cargo binstall dioxus-cli`.
- **Zed:** Downloaded from the upstream binary on each `dotfiles apply` if a newer version is available.
- **LSP servers** (Zed/Cursor): managed automatically by the IDE when opening a file.
- **LSP servers** (OpenCode personal): installed via Home Manager in `apps/opencode/module.nix`.
  Apply with `dotfiles apply` (or `dotfiles workstation apply`).
