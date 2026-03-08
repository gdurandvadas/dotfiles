# Dotfiles bootstrap and switch targets.
# Run from the repo root (e.g. ~/.config/dotfiles).

DOTFILES_DIR ?= $(HOME)/.config/dotfiles

.PHONY: bootstrap switch-personal switch-work workstation

bootstrap:
	@command -v nix >/dev/null 2>&1 || { echo "Nix not found. Install from: https://github.com/DeterminateSystems/nix-installer"; exit 1; }
	@test -f $(DOTFILES_DIR)/hosts/local.nix || { cp $(DOTFILES_DIR)/hosts/local.nix.example $(DOTFILES_DIR)/hosts/local.nix; echo "Created hosts/local.nix from example. Edit it with your identity, then run: make bootstrap"; exit 1; }
	@nix develop $(DOTFILES_DIR)#bootstrap --command op account list >/dev/null 2>&1 || { echo "Signing in to 1Password..."; nix develop $(DOTFILES_DIR)#bootstrap --command op signin; }
	@cd $(DOTFILES_DIR) && nix run .#switch-personal
