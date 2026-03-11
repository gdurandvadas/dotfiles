{ config, lib, ... }: {
  # Override git email for work context (name stays the same)
  programs.git.settings.user.email = lib.mkForce config.my.user.workEmail;

}
