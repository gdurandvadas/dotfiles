{ config, pkgs, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
  link = target: {
    source = config.lib.file.mkOutOfStoreSymlink target;
    force = true;
  };
in {
  # opencode binary is managed by Homebrew (anomalyco/tap/opencode).
  # Launch via oc-pers, which sets OPENCODE_CONFIG and OPENCODE_CONFIG_DIR.
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
