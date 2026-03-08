#!/usr/bin/env bash
# Unified script for home-manager and darwin profile switches.
# Usage:
#   dotfiles profile work       → home-manager switch #work
#   dotfiles profile personal   → home-manager switch #personal
#   dotfiles workstation rebuild → darwin-rebuild switch #workstation

set -e
DOTFILES="${DOTFILES_DIR:-$HOME/.config/dotfiles}"

usage() {
  echo "Usage: dotfiles profile <work|personal>"
  echo "       dotfiles workstation rebuild"
  echo ""
  echo "  profile work       - nix run \$DOTFILES#switch-work (uses flake's home-manager)"
  echo "  profile personal   - nix run \$DOTFILES#switch-personal (uses flake's home-manager)"
  echo "  workstation rebuild - darwin-rebuild switch --flake $DOTFILES#workstation --impure"
  exit 1
}

case "${1:-}" in
  profile)
    case "${2:-}" in
      work)
        exec nix run "$DOTFILES#switch-work" -- "${@:3}"
        ;;
      personal)
        exec nix run "$DOTFILES#switch-personal" -- "${@:3}"
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
