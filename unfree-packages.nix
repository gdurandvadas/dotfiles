# Single source of truth for unfree package names.
# - base: used by the flake's allowUnfreePredicate (home-manager profiles).
# - darwinExtra: extra names for nix-darwin (e.g. 1password-gui).
# When adding an unfree package in modules/tools.nix (or elsewhere), add its
# pkg name to base (or darwinExtra if only needed on darwin).
{
  base = [
    "brave"
    "cursor"
    "surrealdb"
    "cursor-cli"
    "claude-code"
    "cloudflared"
    "antigravity"
    "1password-cli"
  ];
  darwinExtra = [ "1password-gui" ];
}
