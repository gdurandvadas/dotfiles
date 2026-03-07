{ config, ... }: {
  imports = [ ../default.nix ../modules/work.nix ];

  home = {
    username      = config.my.user.username;
    homeDirectory = "/Users/${config.my.user.username}";
    stateVersion  = "25.11";
  };
}
