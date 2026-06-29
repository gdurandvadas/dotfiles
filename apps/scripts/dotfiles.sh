#!/usr/bin/env bash
# Unified script for Home Manager and nix-darwin applies.
# Usage:
#   dotfiles apply             → apply Home Manager config only
#   dotfiles workstation apply → apply nix-darwin, brew, and Home Manager
#   dotfiles update [--darwin] → nix flake update, then apply Home Manager config

set -e
DOTFILES="${DOTFILES_DIR:-$HOME/.config/dotfiles}"

usage() {
  echo "Usage: dotfiles apply"
  echo "       dotfiles workstation apply"
  echo "       dotfiles update [--darwin] [nix flake update inputs...]"
  echo ""
  echo "  apply             - apply Home Manager config (config files only)"
  echo "  workstation apply - apply nix-darwin config (also runs brew installs/upgrades)"
  echo "  update            - nix flake update, then apply Home Manager config"
  echo "                        Use --darwin to also run darwin-rebuild switch."
  exit 1
}

case "${1:-}" in
  apply)
    exec nix run "$DOTFILES#apply" -- "${@:2}"
    ;;
  update)
    flake_args=()
    include_darwin=0
    for a in "${@:2}"; do
      case "$a" in
        --darwin) include_darwin=1 ;;
        *) flake_args+=("$a") ;;
      esac
    done

    nix flake update --flake "$DOTFILES" "${flake_args[@]}"
    nix run "$DOTFILES#apply" --

    if [[ "$include_darwin" -eq 1 ]]; then
      if command -v darwin-rebuild >/dev/null 2>&1; then
        echo "Running darwin-rebuild switch..."
        sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure
      else
        echo "dotfiles update: --darwin ignored (darwin-rebuild not found)" >&2
      fi
    fi
    ;;
  workstation)
    if [ "${2:-}" = "apply" ]; then
      exec sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure "${@:3}"
    else
      echo "Expected: apply"
      usage
    fi
    ;;
  *)
    usage
    ;;
esac
