# Only used by devShells.bootstrap (provides `op` CLI for new-machine setup).
# All other tools are managed by Homebrew and do not go through nixpkgs.
{
  base        = [ "1password-cli" ];
  darwinExtra = [ ];
}
