# Unfree packages here (e.g. _1password-cli, brave) must have their pkg name
# listed in unfree-packages.nix so the flake's allowUnfreePredicate allows them.
{ pkgs, ... }: {
  home.packages = with pkgs; [
    _1password-cli
    brave
    mise
    gh
    protobuf
    wasm-pack
  ];

  xdg.configFile."mise/config.toml".source = ../config/mise/config.toml;
}
