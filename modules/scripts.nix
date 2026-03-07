{ pkgs, ... }:
let
  # Bootstrap an AI-assisted project: research phase then open in Zed
  ai-init = pkgs.writeShellScriptBin "ai-init" ''
    set -e
    if [ -z "$1" ]; then
      echo "Usage: ai-init <topic>"
      exit 1
    fi
    echo "Initializing AI research phase for: $1"
    opencode --skill deep_research "$1"
    zed .
  '';

  # Switch to latest home-manager configuration
  dotfiles-switch = pkgs.writeShellScriptBin "dotfiles-switch" ''
    set -e
    DOTFILES="$HOME/.config/dotfiles"
    echo "Switching to latest dotfiles configuration..."
    home-manager switch --flake "$DOTFILES#gedv" "$@"
  '';
in {
  home.packages = [ ai-init dotfiles-switch ];
}
