{ config, ... }: {
  # Brew cask manages the alacritty binary and font; HM owns the config files.
  xdg.configFile."alacritty/alacritty.toml".text =
    (import ./alacritty.nix) config.home.homeDirectory;
  xdg.configFile."alacritty/keybindings.toml" = {
    source = config.lib.file.mkOutOfStoreSymlink
      "${config.home.homeDirectory}/.config/dotfiles/apps/alacritty/keybindings.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_dark.toml" = {
    source = config.lib.file.mkOutOfStoreSymlink
      "${config.home.homeDirectory}/.config/dotfiles/apps/alacritty/themes/alacritty_dark.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_light.toml" = {
    source = config.lib.file.mkOutOfStoreSymlink
      "${config.home.homeDirectory}/.config/dotfiles/apps/alacritty/themes/alacritty_light.toml";
    force = true;
  };
}
