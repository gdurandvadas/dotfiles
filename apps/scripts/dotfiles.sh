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
  echo "       dotfiles update [--darwin] [nix flake update inputs...]"
  echo ""
  echo "  profile work        - nix run \$DOTFILES#switch-work (uses flake's home-manager)"
  echo "  profile personal    - nix run \$DOTFILES#switch-personal (uses flake's home-manager)"
  echo "  workstation rebuild - darwin-rebuild switch --flake $DOTFILES#workstation --impure"
  echo "  update              - nix flake update, then home-manager switch for your profile"
  echo "                        Profile: \$DOTFILES_PROFILE or first line of \$DOTFILES/.dotfiles-profile"
  echo "                        (default: personal). Use --darwin to also darwin-rebuild switch."
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

    PROFILE="${DOTFILES_PROFILE:-}"
    if [[ -z "$PROFILE" && -f "$DOTFILES/.dotfiles-profile" ]]; then
      PROFILE="$(head -n 1 "$DOTFILES/.dotfiles-profile")"
    fi
    if [[ -n "${PROFILE:-}" ]]; then
      PROFILE="$(printf '%s' "$PROFILE" | tr -d '\r\n' | awk '{print $1}')"
    fi
    PROFILE="${PROFILE:-personal}"
    case "$PROFILE" in
      work|personal) ;;
      *)
        echo "dotfiles update: profile must be 'personal' or 'work' (got '${PROFILE}'). Set DOTFILES_PROFILE or \$DOTFILES/.dotfiles-profile." >&2
        exit 1
        ;;
    esac

    echo "Applying home-manager profile: $PROFILE"
    nix run "$DOTFILES#switch-${PROFILE}" --

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
