{ config, pkgs, ... }: {
  home.sessionVariables = {
    XDG_CONFIG_HOME = "$HOME/.config";
    PROJECTS_DIR = "$HOME/Development";
  };

  home.sessionPath = [ "$HOME/.local/bin" ];

  home.packages = with pkgs; [
    fzf
    ripgrep
    fd
    bat
    eza
    jq
    yq
    git
  ];

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    initContent = ''
      # Load custom scripts (using (N) to avoid errors if no files exist)
      for f in $HOME/.zsh/*.zsh(N); do source $f; done
    '';
  };

  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };

  programs.git = {
    enable = true;
    settings = {
      user = {
        name = config.my.user.name;
        email = config.my.user.email;
        signingkey = config.my.user.sshSigningKey;
      };
      gpg.format = "ssh";
      "gpg \"ssh\"".program = "/Applications/1Password.app/Contents/MacOS/op-ssh-sign";
      commit.gpgsign = true;
      pull.rebase = true;
      fetch.prune = true;
      fetch.pruneTags = true;
    };
  };
}
