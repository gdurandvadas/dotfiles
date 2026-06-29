{ ... }: {
  # mise binary is managed by Homebrew; init is sourced via apps/scripts/mise.zsh.
  xdg.configFile."mise/config.toml".source = ./config.toml;
}
