# dotfiles

**Goal:** A fast, GPU-friendly development environment with **editor, CLI, and agent tooling** plus a **Rust-first** toolchain. Nix + Home Manager keep everything reproducible.

![Screenshot](docs/screenshot.png)

## First-time install

1. **Install Nix** (macOS):

   ```sh
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

   Restart your terminal after install.

2. **Clone and enter the repo:**

   ```sh
   git clone https://github.com/gedv/dotfiles ~/.config/dotfiles
   cd ~/.config/dotfiles
   ```

3. **Create your identity file:**

   ```sh
   cp hosts/local.nix.example hosts/local.nix
   ```

   Edit `hosts/local.nix` with your name, emails, username, and GitHub handle (this file is gitignored).

4. **Apply:**

   ```sh
   nix run .#apply
   ```

   On a nix-darwin workstation, bootstrap the full system with `dotfiles-apply` after the first darwin build — see [docs/bootstrap.md](docs/bootstrap.md).

---

More details (structure, all bootstrap options, daily use, adding tools): **[docs/](docs/)**.
