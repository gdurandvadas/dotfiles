{ pkgs, config, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/opencode";
  mkLink = path: {
    source = config.lib.file.mkOutOfStoreSymlink "${dotfiles}/${path}";
    force = true;
  };
in {
  home.packages = with pkgs; [
    opencode
    playwright
  ];

  xdg.configFile = {
    "opencode/config.json" = mkLink "config.json";
    "opencode/AGENTS.md" = mkLink "AGENTS.md";
    "opencode/agents" = mkLink "agents";
    "opencode/tools" = mkLink "tools";
    "opencode/plugins" = mkLink "plugins";
    "opencode/skills" = mkLink "skills";
    "opencode/workflows" = mkLink "workflows";
  };

  home.activation.opencode-deps = config.lib.dag.entryAfter [ "writeBoundary" ] ''
    if command -v bun >/dev/null 2>&1; then
      cd "${dotfiles}" && bun install --frozen-lockfile 2>/dev/null || bun install 2>/dev/null
    fi
  '';
}
