{ pkgs, ... }: {
  imports = [ ../default.nix ];

  home = {
    username = "gedv";
    homeDirectory = "/Users/gedv";
    stateVersion = "24.11";
  };
}
