{ config, pkgs, alacrittyConfigPath, ... }: {
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

  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  # Starship: dark (mocha) / light (frappe); script symlinks ~/.config/starship.toml to one
  xdg.configFile."starship/starship_dark.toml".source = ../config/starship/starship_dark.toml;
  xdg.configFile."starship/starship_light.toml".source = ../config/starship/starship_light.toml;

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

  # Generated from config/alacritty/alacritty.nix (path from flake).
  xdg.configFile."alacritty/alacritty.toml" = {
    source = pkgs.writeText "alacritty.toml" (import alacrittyConfigPath);
    force = true;
  };

  # Alacritty keybindings managed as a store file (tmux-integrated shortcuts)
  xdg.configFile."alacritty/keybindings.toml"= {
    source = ../config/alacritty/keybindings.toml;
    force = true;
  };

  # Alacritty: dark (mocha) / light (frappe); script symlinks themes/theme.toml to one
  xdg.configFile."alacritty/themes/alacritty_dark.toml" = {
    source = ../config/alacritty/themes/alacritty_dark.toml;
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_light.toml" = {
    source = ../config/alacritty/themes/alacritty_light.toml;
    force = true;
  };

  # Custom scripts sourced by .zsh; theme-switch symlinks Alacritty theme + Starship config by dark/light
  home.file.".zsh/theme-switch.zsh".source = ../config/scripts/theme-switch.zsh;
}
