#!/usr/bin/env bash
# Switch to personal OpenCode config and launch.
# Restores the home-manager managed symlink pointing to the personal config.

set -e

LINK="$HOME/.config/opencode/config.json"
PERSONAL="$HOME/.config/dotfiles/config/opencode/config.json"

ln -sf "$PERSONAL" "$LINK"
exec opencode "$@"
