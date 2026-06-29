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
      description = "Email used for git commits.";
    };
    username = mkOption {
      type = types.str;
      description = "System username (used for home directory path and login).";
    };
    githubUsername = mkOption {
      type = types.str;
      description = "GitHub username used by gh CLI and git config.";
    };
    sshSigningKey = mkOption {
      type = types.str;
      description = "SSH public key used for signing git commits (via 1Password).";
    };
  };
}
