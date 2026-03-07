{ config, pkgs, ... }: {
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


  #####################
  # ZSH               #
  #####################
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

  # Custom scripts sourced by .zsh; theme-switch symlinks Alacritty theme + Starship config by dark/light
  home.file.".zsh/theme-switch.zsh".source = ../config/scripts/theme-switch.zsh;

  #####################
  # Starship          #
  #####################
  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  # Starship: dark (mocha) / light (frappe); script symlinks ~/.config/starship.toml to one
  xdg.configFile."starship/starship_dark.toml".source = ../config/starship/starship_dark.toml;
  xdg.configFile."starship/starship_light.toml".source = ../config/starship/starship_light.toml;

  #####################
  # Fonts (Alacritty) #
  #####################
  fonts.packages = with pkgs; [
    (nerdfonts.override { fonts = [ "FiraCode" ]; })
  ];

  #####################
  # Alacritty         #
  #####################
  programs.alacritty = {
    enable = true;
  };

  # Symlinks into dotfiles repo (edit there, changes apply without rebuild).
  xdg.configFile."alacritty/alacritty.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/alacritty.toml";
    force = true;
  };
  xdg.configFile."alacritty/keybindings.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/keybindings.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_dark.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/themes/alacritty_dark.toml";
    force = true;
  };
  xdg.configFile."alacritty/themes/alacritty_light.toml" = {
    source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/config/alacritty/themes/alacritty_light.toml";
    force = true;
  };

  #####################
  # Direnv          #
  #####################
  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
  };

  #####################
  # Git               #
  #####################
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
}
