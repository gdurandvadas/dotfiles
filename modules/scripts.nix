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

  # Switch to latest nix-darwin + home-manager configuration
  # Usage: dotfiles-switch
  dotfiles-switch = pkgs.writeShellScriptBin "dotfiles-switch" ''
    set -e
    DOTFILES="$HOME/.config/dotfiles"
    echo "Switching to dotfiles (darwin + home-manager)"
    # Pass DOTFILES_DIR explicitly so builtins.getEnv resolves correctly even
    # when nix-darwin activation runs as root and nix resets HOME to /var/root.
    sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure "$@"
  '';

  # Install dotfiles from config/scripts (profile work|personal, workstation rebuild).
  # Script must be tracked (git add) so the flake store copy includes it.
  dotfiles = pkgs.writeShellScriptBin "dotfiles" (builtins.readFile ../config/scripts/dotfiles.sh);
in {
  home.packages = [ ai-init dotfiles-switch dotfiles ];
}
