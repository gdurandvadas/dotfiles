{ ... }: {
  # zellij binary is managed by Homebrew.
  xdg.configFile."zellij/config.kdl".source           = ./config.kdl;
  xdg.configFile."zellij/layouts/default.kdl".source  = ./layouts/default.kdl;
}
