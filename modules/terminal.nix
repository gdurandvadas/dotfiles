{ config, pkgs, ... }: {
  # Ensure XDG_CONFIG_HOME is set so apps like Zed resolve ~/.config/zed/ on macOS
  home.sessionVariables = {
    XDG_CONFIG_HOME = "$HOME/.config";
  };

  home.packages = with pkgs; [
    # Shell utilities
    fzf
    ripgrep
    fd
    bat
    eza
    jq
    yq
    gh
    git
  ];

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    initExtra = ''
      # Load custom scripts (using (N) to avoid errors if no files exist)
      for f in $HOME/.zsh/*.zsh(N); do source $f; done
    '';
  };

  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  xdg.configFile."starship.toml".source = ../config/starship/starship.toml;

  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };

  programs.git = {
    enable = true;
    settings = {
      user = {
        name  = config.my.user.name;
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

  programs.alacritty = {
    enable = true;
  };

  xdg.configFile."alacritty/alacritty.toml".source = ../config/alacritty/alacritty.toml;

  # Alacritty keybindings managed as a store file (tmux-integrated shortcuts)
  xdg.configFile."alacritty/keybindings.toml".source = ../config/alacritty/keybindings.toml;
}
