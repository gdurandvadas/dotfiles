{ pkgs, ... }:
let
  dotfiles-switch = pkgs.writeShellScriptBin "dotfiles-switch" ''
    set -e
    DOTFILES="$HOME/.config/dotfiles"
    echo "Switching to dotfiles (darwin + home-manager)"
    # Pass DOTFILES_DIR explicitly so builtins.getEnv resolves correctly even
    # when nix-darwin activation runs as root and nix resets HOME to /var/root.
    sudo DOTFILES_DIR="$DOTFILES" darwin-rebuild switch --flake "$DOTFILES#workstation" --impure "$@"
  '';

  dotfiles = pkgs.writeShellScriptBin "dotfiles" (builtins.readFile ./dotfiles.sh);
  z = pkgs.writeShellScriptBin "z" (builtins.readFile ./z.sh);
  c = pkgs.writeShellScriptBin "c" (builtins.readFile ./c.sh);
  oc-pers = pkgs.writeShellScriptBin "oc-pers" (builtins.readFile ./oc-pers.sh);
  oc-work = pkgs.writeShellScriptBin "oc-work" (builtins.readFile ./oc-work.sh);
in {
  home.packages = [ dotfiles-switch dotfiles z c oc-pers oc-work ];

  home.file.".zsh/theme-switch.zsh".source = ./theme-switch.zsh;
  home.file.".zsh/mise.zsh".source         = ./mise.zsh;
  home.file.".zsh/direnv.zsh".source       = ./direnv.zsh;
  home.file.".zsh/starship.zsh".source     = ./starship.zsh;
  home.file.".zsh/z.zsh".source            = ./z.zsh;
}
