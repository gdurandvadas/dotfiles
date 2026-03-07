#!/usr/bin/env bash
# Unified script for home-manager and darwin profile switches.
# Usage:
#   nix-switch profile work       → home-manager switch #work
#   nix-switch profile personal   → home-manager switch #personal
#   nix-switch workstation rebuild → darwin-rebuild switch #workstation

set -e
DOTFILES="${DOTFILES_DIR:-$HOME/.config/dotfiles}"

usage() {
  echo "Usage: nix-switch profile <work|personal>"
  echo "       nix-switch workstation rebuild"
  echo ""
  echo "  profile work       - home-manager switch --flake $DOTFILES#work --impure"
  echo "  profile personal   - home-manager switch --flake $DOTFILES#personal --impure"
  echo "  workstation rebuild - darwin-rebuild switch --flake $DOTFILES#workstation --impure"
  exit 1
}

case "${1:-}" in
  profile)
    case "${2:-}" in
      work)
        exec nix run home-manager/release-25.11 -- switch --flake "$DOTFILES#work" --impure "${@:3}"
        ;;
      personal)
        exec nix run home-manager/release-25.11 -- switch --flake "$DOTFILES#personal" --impure "${@:3}"
        ;;
      *)
        echo "Expected: work or personal"
        usage
        ;;
    esac
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
