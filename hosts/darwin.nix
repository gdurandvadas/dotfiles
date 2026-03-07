{ pkgs, config, lib, ... }: {
  nixpkgs.config.allowUnfreePredicate = pkg: builtins.elem (lib.getName pkg) [
    "1password-cli"
    "1password-gui"
    "brave"
  ];

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

  # Font package is set in flake.nix (fonts.packages in darwin module).

  # Define the user
  system.primaryUser = config.my.user.username;
  users.users.${config.my.user.username} = {
    name = config.my.user.username;
    home = "/Users/${config.my.user.username}";
  };
}
