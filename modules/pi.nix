{ config, pkgs, ... }:
let
  hd = config.home.homeDirectory;
  dotfiles = "${hd}/.config/dotfiles/config/pi";
  mkLink = path: {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/${path}";
    force = true;
  };
in {
  home.packages = with pkgs; [
    pi-coding-agent
  ];

  home.file = {
    ".pi/agent/settings.json" = mkLink "settings.json";
    ".pi/agent/AGENTS.md" = mkLink "AGENTS.md";
  };
}
