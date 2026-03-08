{ config, lib, pkgs, ... }: {
  imports = [
    ./modules/user.nix
    ./modules/shell.nix
    ./modules/terminal.nix
    ./modules/editor.nix
    ./modules/ai.nix
    ./modules/scripts.nix
    ./modules/tools.nix
  ];

  programs.home-manager.enable = true;

  # Disable copying apps into ~/Applications (and the App Management permission check).
  # Re-enable if you can grant System Settings > Privacy & Security > App Management.
  targets.darwin.copyApps.enable = lib.mkIf pkgs.stdenv.hostPlatform.isDarwin false;
}
