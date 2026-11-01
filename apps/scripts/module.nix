{ pkgs, ... }:
let
  dotfiles-apply = pkgs.writeShellScriptBin "dotfiles-apply" ''
    set -e
    DOTFILES="$HOME/.config/dotfiles"
    echo "Applying dotfiles (nix-darwin + Home Manager)"
    # Pass DOTFILES_DIR explicitly so builtins.getEnv resolves correctly even
    # when nix-darwin activation runs as root and nix resets HOME to /var/root.
    sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure "$@"
  '';

  dotfiles = pkgs.writeShellScriptBin "dotfiles" (builtins.readFile ./dotfiles.sh);
  z = pkgs.writeShellScriptBin "z" (builtins.readFile ./z.sh);
  git-update-all = pkgs.writeShellScriptBin "git-update-all" (builtins.readFile ./git-update-all.sh);
in {
  home.packages = [ dotfiles-apply dotfiles z git-update-all ];

  home.file.".zsh/theme-switch.zsh".source = ./theme-switch.zsh;
  home.file.".zsh/mise.zsh".source         = ./mise.zsh;
  home.file.".zsh/direnv.zsh".source       = ./direnv.zsh;
  home.file.".zsh/starship.zsh".source     = ./starship.zsh;
  home.file.".zsh/z.zsh".source            = ./z.zsh;
}
