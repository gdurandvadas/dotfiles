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

  # Symlinks into dotfiles repo (edit there, changes apply without rebuild).
  xdg.configFile."zed/settings.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/zed/settings.json";
    force = true;
  };
  xdg.configFile."zed/keymap.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/zed/keymap.json";
    force = true;
  };
}
