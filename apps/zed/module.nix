{ pkgs, config, ... }: {
  home.packages = with pkgs; [
    zed-editor
    code-cursor
    gopls
    rust-analyzer
    vtsls
    nixd
    sqls
  ];

  xdg.configFile."zed/settings.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/apps/zed/settings.json";
    force = true;
  };
  xdg.configFile."zed/keymap.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/apps/zed/keymap.json";
    force = true;
  };
}
