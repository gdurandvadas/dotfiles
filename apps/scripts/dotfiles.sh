#!/usr/bin/env bash
# Unified script for home-manager and darwin switches.
# Usage:
#   dotfiles switch              → home-manager switch (config files only)
#   dotfiles workstation rebuild → darwin-rebuild switch #workstation (brew + config)
#   dotfiles update [--darwin]   → nix flake update, then home-manager switch

set -e
DOTFILES="${DOTFILES_DIR:-$HOME/.config/dotfiles}"

usage() {
  echo "Usage: dotfiles switch"
  echo "       dotfiles workstation rebuild"
  echo "       dotfiles update [--darwin] [nix flake update inputs...]"
  echo ""
  echo "  switch              - apply Home Manager config (config files only)"
  echo "  workstation rebuild - darwin-rebuild switch (also runs brew installs/upgrades)"
  echo "  update              - nix flake update, then home-manager switch"
  echo "                        Use --darwin to also run darwin-rebuild switch."
  exit 1
}

case "${1:-}" in
  switch)
    exec nix run "$DOTFILES#switch" -- "${@:2}"
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
    nix run "$DOTFILES#switch" --

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
    if [ "${2:-}" = "rebuild" ]; then
      exec sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure "${@:3}"
    else
      echo "Expected: rebuild"
      usage
    fi
    ;;
  *)
    usage
    ;;
esac
