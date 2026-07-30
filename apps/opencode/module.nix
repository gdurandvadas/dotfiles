{ config, pkgs, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
  link = target: {
    source = config.lib.file.mkOutOfStoreSymlink target;
    force = true;
  };
in {
  # OpenCode v2 is pinned through mise's npm backend.
  # Launch via oc, which sets OPENCODE_CONFIG and OPENCODE_CONFIG_DIR.
  # Language servers below are on PATH for OpenCode LSP (see config.jsonc).

  home.packages = with pkgs; [
    rust-analyzer
    gopls
    typescript
    typescript-language-server
    pyright
    yaml-language-server
    bash-language-server
    sqls
    vscode-langservers-extracted
  ];

  xdg.configFile."opencode-personal" = link dotfiles;
}
