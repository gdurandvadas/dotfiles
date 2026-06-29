{ config, ... }: {
  home.sessionVariables = {
    XDG_CONFIG_HOME = "$HOME/.config";
    PROJECTS_DIR    = "$HOME/Development";
  };

  home.sessionPath = [ "$HOME/.local/bin" ];

  # Brew manages the zsh binary; HM writes the config file.
  home.file.".zshrc".text = ''
    # HM session variables: XDG_CONFIG_HOME, PROJECTS_DIR, PATH extensions
    [ -f "''${HOME}/.nix-profile/etc/profile.d/hm-session-vars.sh" ] \
      && source "''${HOME}/.nix-profile/etc/profile.d/hm-session-vars.sh"

    eval "$(/opt/homebrew/bin/brew shellenv)"

    autoload -Uz compinit && compinit

    source "$(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
    source "$(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"

    source <(fzf --zsh)

    for f in ''${HOME}/.zsh/*.zsh(N); do source "$f"; done
  '';

  # Git config — reads identity from my.user (set in hosts/local.nix).
  xdg.configFile."git/config".text = ''
    [user]
      name       = ${config.my.user.name}
      email      = ${config.my.user.email}
      signingkey = ${config.my.user.sshSigningKey}
    [gpg]
      format = ssh
    [gpg "ssh"]
      program = /Applications/1Password.app/Contents/MacOS/op-ssh-sign
    [commit]
      gpgsign = true
    [pull]
      rebase = true
    [fetch]
      prune     = true
      pruneTags = true
  '';
}
