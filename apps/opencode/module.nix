{ config, pkgs, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
in {
  # Keep the managed-agent profile mutable so its pinned plugin dependency can
  # be developed and verified in place.
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
