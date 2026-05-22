# Unfree packages here (e.g. _1password-cli, brave) must have their pkg name
# listed in unfree-packages.nix so the flake's allowUnfreePredicate allows them.
{ pkgs, ... }: {
  home.packages = with pkgs; [
    gh
    mise
    brave
    tflint
    protobuf
    wasm-pack
    dioxus-cli
    cursor-cli
    gemini-cli
    antigravity
    claude-code
    codex
    cloudflared
    terraform-docs
    pulumi
    awscli2
    _1password-cli
  ];

  xdg.configFile."mise/config.toml".source = ../apps/mise/config.toml;
}
