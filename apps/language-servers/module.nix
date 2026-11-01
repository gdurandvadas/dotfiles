{ pkgs, ... }: {
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
