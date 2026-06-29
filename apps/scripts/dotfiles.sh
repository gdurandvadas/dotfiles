#!/usr/bin/env bash
# Unified script for home-manager and darwin switches.
# Usage:
#   dotfiles switch              → home-manager switch
#   dotfiles workstation rebuild → darwin-rebuild switch #workstation
#   dotfiles update [--darwin]   → nix flake update, then home-manager switch

set -e
DOTFILES="${DOTFILES_DIR:-$HOME/.config/dotfiles}"
# shellcheck source=ensure-binary-cache.sh
source "$DOTFILES/apps/scripts/ensure-binary-cache.sh"

usage() {
  echo "Usage: dotfiles switch"
  echo "       dotfiles workstation rebuild"
  echo "       dotfiles update [--darwin] [nix flake update inputs...]"
  echo ""
  echo "  switch              - nix run \$DOTFILES#switch (uses flake's home-manager)"
  echo "  workstation rebuild - darwin-rebuild switch --flake $DOTFILES#workstation --impure"
  echo "  update              - nix flake update, then home-manager switch"
  echo "                        Use --darwin to also darwin-rebuild switch."
  echo "                        Refuses nixpkgs source builds and input mismatches."
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

    lock_backup="$(mktemp)"
    cp "$DOTFILES/flake.lock" "$lock_backup"
    trap 'rm -f "$lock_backup"' RETURN

    nix flake update --flake "$DOTFILES" "${flake_args[@]}"
    if ! ensure_binary_cache_switch "$DOTFILES" personal "dotfiles update"; then
      cp "$lock_backup" "$DOTFILES/flake.lock"
      echo "dotfiles update: restored previous flake.lock." >&2
      exit 1
    fi
    env DOTFILES_SKIP_BINARY_GUARD=1 nix run "$DOTFILES#switch" --

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
