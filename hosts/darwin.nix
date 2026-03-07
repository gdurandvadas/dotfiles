{ pkgs, ... }: {
  # Auto upgrade nix package and the daemon service.
  # We set this to false because Determinate Systems installer manages the Nix daemon
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

  # Install fonts
  fonts.packages = [
    pkgs.nerd-fonts.zed-mono
  ];

  # Define the user
  system.primaryUser = "gedv";
  users.users.gedv = {
    name = "gedv";
    home = "/Users/gedv";
  };
}
