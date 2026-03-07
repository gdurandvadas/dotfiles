# 1Password secrets management

This repo does **not** store API keys, tokens, or passwords. Identity (name, emails, username) lives in gitignored `hosts/local.nix`. For other secrets, use **1Password** as the source of truth and inject at runtime with the 1Password CLI.

## What’s already in the repo

- **Git SSH signing**: Commit signing uses 1Password via `op-ssh-sign` (see `programs.git` in `modules/terminal.nix`). The public key is in `my.user.sshSigningKey` in `hosts/local.nix`.
- **1Password CLI**: The `op` CLI is installed via `modules/tools.nix` (unfree; allowlisted in the flake). Sign in with `op signin` (or use biometrics / SSH agent where supported).

## Principle

Do not put secrets in the Nix store or in committed config. Use 1Password items and reference them by vault/item/field. At runtime, use `op read` or `op run` to inject values into environment variables or scripts.

## Using the 1Password CLI

### Sign in

```bash
op signin
# Or with a specific account: op signin --account my.1password.com
```

Session is stored in the environment (`OP_SESSION_...`) or in the 1Password agent.

### Read a single secret

Reference format: `op://Vault/Item/field` (or use item name).

```bash
# Output secret to stdout (e.g. for a password, API key)
op read "op://Private/My API Credentials/credential"

# Use in a script
export API_KEY=$(op read "op://Private/My API Credentials/credential")
./my-script
```

### Run a command with secrets in the environment

Use `op run` so 1Password injects env vars only for the duration of that command (no secrets in your shell history or config).

**Option 1 — `.env.1password` file (template)**

Create a file (e.g. in the project or in `~/.config/dotfiles` if you want it outside the repo) that lists which 1Password references map to which env var names. Do **not** put real values in this file; only references:

```bash
# .env.1password (do not commit if it contains item names you consider sensitive)
API_KEY=op://Private/My API Credentials/credential
GH_TOKEN=op://Private/GitHub/credential
```

Then:

```bash
op run --env-file=".env.1password" -- ./my-script
```

`op run` will resolve each reference and set the corresponding env var for `my-script`.

**Option 2 — Inline in a wrapper script**

```bash
#!/usr/bin/env bash
set -e
export API_KEY=$(op read "op://Private/My API Credentials/credential")
exec my-app
```

Run the wrapper when you need the app with secrets; do not put the wrapper in the Nix store with secrets embedded—only `op read` calls.

### Inject into a file (templates)

For tools that read a config file (e.g. a token in a JSON file), use `op inject`:

1. Create a template file with placeholders like `op://Vault/Item/field`.
2. Run `op inject -i template.json -o config.json` (or inline) so 1Password replaces the placeholders with the secret values.
3. Use `config.json` only in that session; do not commit it.

## Shell integration (optional)

If you want certain env vars available in your shell (e.g. for development), you can source a script that runs `op read` and exports them. Keep that script out of the Nix store and out of the repo (e.g. in `~/.zsh/local.zsh` and source it from your shell).

```bash
# Example ~/.zsh/local.zsh (not in this repo)
if command -v op &>/dev/null; then
  export GH_TOKEN=$(op read "op://Private/GitHub/credential" 2>/dev/null) || true
fi
```

**Warning:** Exported secrets live in your shell process; avoid logging and be aware of subprocess inheritance. Prefer `op run --env-file=... -- <command>` for one-off commands so secrets are not in your profile.

## Direnv and per-project secrets

For a project that needs secrets only when you `cd` in:

```bash
# .envrc (in the project; can use op run so secrets never touch disk as plain text)
op run --env-file=".env.1password" -- direnv exec . true
# Then in the same .envrc you can export or use the env for the rest of direnv
```

Or use `op run --env-file=".env.1password" --` as a prefix for the main command you run in that directory. Do not commit `.env.1password` if it references sensitive item names (or use a private/config vault).

## Nix and secrets

- **Home Manager** config and **Nix store** must not contain secrets. Do not add API keys or tokens to `.nix` files or to `home.sessionVariables` with secret values.
- Use 1Password + `op run` or wrapper scripts that call `op read` so secrets stay in 1Password and are only present in process memory when needed.

## Where to store items in 1Password

- Create a vault (e.g. “Private” or “Dev”) for credentials used by scripts and tools.
- Store each secret as a Login item or Secure Note; use a consistent name (e.g. “My API Credentials”) and reference it as `op://VaultName/ItemName/credential` (or the specific field name).
- For GitHub, npm, etc., you can use 1Password’s built-in integration or store a single credential field and reference it with `op read "op://Vault/ItemName/credential"`.
