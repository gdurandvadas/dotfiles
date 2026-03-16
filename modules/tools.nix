# Unfree packages here (e.g. _1password-cli, brave) must have their pkg name
# listed in unfree-packages.nix so the flake's allowUnfreePredicate allows them.
{ pkgs, ... }: {
  home.packages = with pkgs; [
    gh
    mise
    brave
    protobuf
    surrealdb
    wasm-pack
    dioxus-cli
    cursor-cli
    claude-code
    cloudflared
    _1password-cli
  ];

  xdg.configFile."mise/config.toml".source = ../config/mise/config.toml;
}
