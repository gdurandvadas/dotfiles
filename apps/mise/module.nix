{ pkgs, ... }: {
  home.packages = with pkgs; [ mise ];
  xdg.configFile."mise/config.toml".source = ./config.toml;
}
