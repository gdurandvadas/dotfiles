{ pkgs, config, ... }: {
  # Auto upgrade nix package and the daemon service.
  nix.enable = false;
  nix.package = pkgs.nix;

  # Necessary for using flakes on this system.
  nix.settings.experimental-features = "nix-command flakes";

  # Setup system defaults
  system.defaults = {
    dock.autohide = true;
    finder.AppleShowAllExtensions = true;
    NSGlobalDomain.KeyRepeat = 2;
  };

  # Set Git commit hash for darwin-version.
  # system.configurationRevision = self.rev or self.dirtyRev or null;

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 5;

  # The platform the configuration will be used on.
  nixpkgs.hostPlatform = "aarch64-darwin";

  # Define the user
  system.primaryUser = config.my.user.username;
  users.users.${config.my.user.username} = {
    name = config.my.user.username;
    home = "/Users/${config.my.user.username}";
  };

  homebrew = {
    enable = true;
    onActivation = {
      autoUpdate = true;
      upgrade    = true;
      cleanup    = "zap";
    };
    taps = [ "anomalyco/tap" ];
    brews = [
      "git"
      "fzf"
      "ripgrep"
      "fd"
      "bat"
      "eza"
      "jq"
      "yq"
      "mise"
      "zellij"
      "gh"
      "pulumi"
      "protobuf"
      "wasm-pack"
      "cloudflared"
      "direnv"
      "starship"
      "zsh-autosuggestions"
      "zsh-syntax-highlighting"
      "anomalyco/tap/opencode"
    ];
    casks = [
      "brave-browser"
      "1password"
      "1password-cli"
      "cursor"
      "cursor-cli"
      "claude-code"
      "codex"
      "antigravity-cli"
      "alacritty"
      "font-fira-code-nerd-font"
    ];
  };
}
