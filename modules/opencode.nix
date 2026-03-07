{ pkgs, config, ... }: {
  home.packages = with pkgs; [
    opencode
  ];

  xdg.configFile."opencode/config.json".source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/opencode/config.json";
}
