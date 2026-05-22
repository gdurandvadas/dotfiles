{ pkgs, ... }:
let
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

  # Install dotfiles from apps/scripts (profile work|personal, workstation rebuild).
  # Script must be tracked (git add) so the flake store copy includes it.
  dotfiles = pkgs.writeShellScriptBin "dotfiles" (builtins.readFile ../apps/scripts/dotfiles.sh);

  # Open a project directory in Zed.
  # Usage: z <dir> [subdir]
  z = pkgs.writeShellScriptBin "z" (builtins.readFile ../apps/scripts/z.sh);
in {
  home.packages = [ dotfiles-switch dotfiles z ];
}
