{ config, pkgs, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
in {
  # Keep the personal OpenCode configuration mutable so its local plugins can
  # install pinned development dependencies beside their source files.
  xdg.configFile."opencode-personal" = {
    source = config.lib.file.mkOutOfStoreSymlink dotfiles;
    force = true;
  };

  home.packages = with pkgs; [
    bash-language-server
    gopls
    pyright
    rust-analyzer
    sqls
    typescript
    typescript-language-server
    vscode-langservers-extracted
    yaml-language-server
  ];
}
