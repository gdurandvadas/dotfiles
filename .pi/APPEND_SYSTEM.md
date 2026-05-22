# Dotfiles Pi Rules

- This repository is a Nix Flakes and Home Manager dotfiles setup for macOS.
- Treat `hosts/local.nix` as private machine identity; never commit it or copy
  identity values into tracked files.
- Prefer declarative Home Manager or nix-darwin configuration over imperative
  setup scripts.
- Use the root `Makefile` targets for multi-repository sync, branch creation,
  and repository status checks when they apply.
- Before starting a task, read `.pi/memory/CORE.md` if it exists and use it as
  project-local memory. Do not assume a self-learning package is installed.
