{ ... }: {
  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  xdg.configFile."starship/starship_dark.toml".source = ./starship_dark.toml;
  xdg.configFile."starship/starship_light.toml".source = ./starship_light.toml;
}
