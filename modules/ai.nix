{ pkgs, config, ... }:
let
  hd = config.home.homeDirectory;
  dotfiles = "${hd}/.config/dotfiles/config/opencode";
  mkLink = path: {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/${path}";
    force = true;
  };
in {
  home.packages = with pkgs; [
    opencode
    playwright
  ];

  xdg.configFile = {
    "opencode/config.json" = mkLink "config.json";
    "opencode/AGENTS.md" = mkLink "AGENTS.md";
    "opencode/agents" = mkLink "agents";
    "opencode/tools" = mkLink "tools";
    "opencode/plugins" = mkLink "plugins";
    "opencode/skills" = mkLink "skills";
  };
}
