{ pkgs, ... }: {
  home.packages = with pkgs; [
    _1password-cli
    brave
    mise
    gh
  ];

  xdg.configFile."mise/config.toml".source = ../config/mise/config.toml;
}
