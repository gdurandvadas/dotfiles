{ config, lib, pkgs, ... }: {
  imports = [
    ./modules/user.nix
    ./apps/shell/module.nix
    ./apps/scripts/module.nix
    ./apps/starship/module.nix
    ./apps/alacritty/module.nix
    ./apps/zellij/module.nix
    ./apps/zed/module.nix
    ./apps/mise/module.nix
    ./apps/tools/module.nix
    ./apps/opencode/module.nix
    ./apps/claude/module.nix
  ];

  programs.home-manager.enable = true;

  # Disable copying apps into ~/Applications (and the App Management permission check).
  # Re-enable if you can grant System Settings > Privacy & Security > App Management.
  targets.darwin.copyApps.enable = lib.mkIf pkgs.stdenv.hostPlatform.isDarwin false;
}
