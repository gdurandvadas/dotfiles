{ pkgs, ... }: {
  home.packages = with pkgs; [
    # Shell utilities
    fzf
    ripgrep
    fd
    bat
    eza
    jq
    gh
    git
  ];

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    initExtra = ''
      # Load custom scripts
      for f in $HOME/.zsh/*.zsh; do source $f; done
    '';
  };

  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };

  programs.git = {
    enable = true;
    userName = "gedv";
  };
}
