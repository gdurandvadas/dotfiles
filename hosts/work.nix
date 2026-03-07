{ config, ... }: {
  imports = [ ../default.nix ../modules/work.nix ./local.nix ];

  home = {
    username      = config.my.user.username;
    homeDirectory = "/Users/${config.my.user.username}";
    stateVersion  = "24.11";
  };
}
