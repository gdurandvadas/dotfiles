{ lib, ... }:
let inherit (lib) mkOption types; in
{
  options.my.user = {
    name = mkOption {
      type = types.str;
      description = "Full name used in git commits and user-facing config.";
    };
    email = mkOption {
      type = types.str;
      description = "Personal email used for git commits.";
    };
    workEmail = mkOption {
      type = types.str;
      default = "";
      description = "Work email, overrides personal email in the work profile.";
    };
    username = mkOption {
      type = types.str;
      description = "System username (used for home directory path and login).";
    };
    githubUsername = mkOption {
      type = types.str;
      description = "GitHub username used by gh CLI and git config.";
    };
  };
}
