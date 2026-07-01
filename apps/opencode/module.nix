{ pkgs, config, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
in {
  # opencode binary is managed by Homebrew (anomalyco/tap/opencode).

  xdg.configFile."opencode/config.jsonc" = {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/config.jsonc";
    force = true;
  };

  xdg.configFile."opencode/opencode.jsonc" = {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/config.jsonc";
    force = true;
  };

  xdg.configFile."opencode/agents" = {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/agents";
    force = true;
  };

  xdg.configFile."opencode/commands" = {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/commands";
    force = true;
  };

  xdg.configFile."opencode/skills" = {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/skills";
    force = true;
  };
}
