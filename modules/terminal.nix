{ config, pkgs, ... }: {
  home.packages = with pkgs; [
    # Fira Code Nerd Font (Alacritty)
    nerd-fonts.fira-code
    # Terminal multiplexer (tabs, panes); Alacritty launches it on startup
    zellij
  ];

  #####################
  # Alacritty         #
  #####################
  programs.alacritty = {
    enable = true;
  };

  # Deploy alacritty.toml from template; shell.program uses home from local.nix.
  xdg.configFile."alacritty/alacritty.toml".text =
    (import ../config/alacritty/alacritty.nix) config.home.homeDirectory;
  xdg.configFile."alacritty/keybindings.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/keybindings.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_dark.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/themes/alacritty_dark.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_light.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/themes/alacritty_light.toml";
    force = true;
  };

  #####################
  # Zellij           #
  #####################
  xdg.configFile."zellij/config.kdl".source = ../config/zellij/config.kdl;
  xdg.configFile."zellij/layouts/default.kdl".source = ../config/zellij/layouts/default.kdl;
}
