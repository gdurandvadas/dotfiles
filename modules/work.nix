{ config, lib, ... }: {
  # Override git email for work context (name stays the same)
  programs.git.settings.user.email = lib.mkForce config.my.user.workEmail;

  # Point opencode to a work-specific config (separate model/MCP settings)
  xdg.configFile."opencode/config.json".source = lib.mkForce
    (config.lib.file.mkOutOfStoreSymlink
      "${config.home.homeDirectory}/.config/dotfiles/config/opencode/work-config.json");
}
