{ config, ... }:
let
  dotfiles = "${config.home.homeDirectory}/.config/dotfiles/apps/claude";
  link = target: {
    source = config.lib.file.mkOutOfStoreSymlink target;
    force = true;
  };
in {
  home.file.".claude/settings.json" = link "${dotfiles}/settings.json";
  home.file.".claude/CLAUDE.md" = link "${dotfiles}/CLAUDE.md";
  home.file.".claude/agents" = link "${dotfiles}/agents";
  home.file.".claude/commands" = link "${dotfiles}/commands";
  home.file.".claude/hooks" = link "${dotfiles}/hooks";
  home.file.".claude/mcp" = link "${dotfiles}/mcp";
  home.file.".claude/mcp.json" = link "${dotfiles}/mcp.json";
}
