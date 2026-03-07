{ pkgs, ... }: {
  home.packages = with pkgs; [
    _1password-cli
    brave
    mise
  ];

  xdg.configFile."mise/config.toml".source = ../config/mise/config.toml;
}
