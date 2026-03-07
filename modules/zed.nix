{ pkgs, config, ... }: {
  home.packages = with pkgs; [
    # Editor
    zed-editor

    # Language servers
    gopls           # Go
    rust-analyzer   # Rust
    vtsls           # TypeScript/JavaScript
    nixd            # Nix
    sqls            # SQL
  ];

  # Symlink config out-of-store so Zed can mutate its own settings
  xdg.configFile."zed/settings.json".source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/zed/settings.json";

  xdg.configFile."zed/keymap.json".source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/zed/keymap.json";
}
