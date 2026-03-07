{ ... }: {
  imports = [
    ./modules/terminal.nix
    ./modules/zed.nix
    ./modules/opencode.nix
    ./modules/scripts.nix
  ];

  programs.home-manager.enable = true;
}
