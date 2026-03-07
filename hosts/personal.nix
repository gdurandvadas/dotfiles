{ config, ... }: {
  imports = [ ../default.nix ];

  home = {
    username      = config.my.user.username;
    homeDirectory = "/Users/${config.my.user.username}";
    stateVersion  = "24.11";
  };
}
