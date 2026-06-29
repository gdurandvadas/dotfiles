{ ... }: {
  # Brew manages the starship binary; init is sourced via apps/scripts/starship.zsh.
  xdg.configFile."starship/starship_dark.toml".source  = ./starship_dark.toml;
  xdg.configFile."starship/starship_light.toml".source = ./starship_light.toml;
}
