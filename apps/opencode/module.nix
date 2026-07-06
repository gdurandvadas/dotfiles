{ config, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
  link = target: {
    source = config.lib.file.mkOutOfStoreSymlink target;
    force = true;
  };
in {
  # opencode binary is managed by Homebrew (anomalyco/tap/opencode).
  # Launch via oc-work / oc-pers — each sets OPENCODE_CONFIG and OPENCODE_CONFIG_DIR.

  xdg.configFile."opencode-work" = link "${dotfiles}/work";
  xdg.configFile."opencode-personal" = link "${dotfiles}/personal";
}
