{ pkgs, ... }: {
  home.packages = with pkgs; [
    gh
    brave
    codex
    tflint
    pulumi
    awscli2
    protobuf
    wasm-pack
    dioxus-cli
    cursor-cli
    gemini-cli
    antigravity
    claude-code
    cloudflared
    _1password-cli
  ];
}
