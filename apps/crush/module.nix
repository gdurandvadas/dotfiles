{ config, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/crush";
  link = target: {
    source = config.lib.file.mkOutOfStoreSymlink target;
    force = true;
  };
in {
  # crush binary is managed by Homebrew (charmbracelet/tap/crush).
  # Launch via cr-work / cr-pers — each sets CRUSH_GLOBAL_CONFIG and CRUSH_GLOBAL_DATA.

  xdg.configFile."crush-work"     = link "${dotfiles}/work";
  xdg.configFile."crush-personal" = link "${dotfiles}/personal";
}
