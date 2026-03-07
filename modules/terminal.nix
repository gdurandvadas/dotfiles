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
    settings = {
      general.import = [ "~/.config/alacritty/keybindings.toml" ];

      window = {
        decorations = "buttonless";
        dynamic_title = true;
        opacity = 0.98;
        dimensions = { columns = 170; lines = 50; };
        padding = { x = 5; y = 7; };
      };

      scrolling = {
        history = 100000;
        multiplier = 3;
      };

      font = {
        normal = { family = "Ellograph CF"; style = "Regular"; };
        bold = { family = "Ellograph CF"; style = "Bold"; };
        italic = { family = "Ellograph CF"; style = "Italic"; };
        bold_italic = { family = "Ellograph CF"; style = "Bold Italic"; };
        size = 13.0;
      };

      selection.save_to_clipboard = true;

      cursor = {
        unfocused_hollow = true;
        style = { shape = "Block"; blinking = "On"; };
      };

      colors = {
        primary = { background = "#1d2021"; foreground = "#d4be98"; };
        normal = {
          black   = "#32302f";
          red     = "#ea6962";
          green   = "#a9b665";
          yellow  = "#d8a657";
          blue    = "#7daea3";
          magenta = "#d3869b";
          cyan    = "#89b482";
          white   = "#d4be98";
        };
        bright = {
          black   = "#32302f";
          red     = "#ea6962";
          green   = "#a9b665";
          yellow  = "#d8a657";
          blue    = "#7daea3";
          magenta = "#d3869b";
          cyan    = "#89b482";
          white   = "#d4be98";
        };
      };
    };
  };

  # Alacritty keybindings managed as a store file (tmux-integrated shortcuts)
  xdg.configFile."alacritty/keybindings.toml".source = ../config/alacritty/keybindings.toml;
}
