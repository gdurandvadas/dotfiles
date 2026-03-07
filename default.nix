{ ... }: {
  imports = [
    ./modules/user.nix
    ./modules/terminal.nix
    ./modules/zed.nix
    ./modules/opencode.nix
    ./modules/scripts.nix
    ./modules/tools.nix
  ];

  programs.home-manager.enable = true;
}
