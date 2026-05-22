# Alacritty config template. Called from modules/terminal.nix with config.home.homeDirectory.
# Returns the alacritty.toml content so shell.program uses the current user's home.
homeDirectory: ''
  [general]
  import = [
      "~/.config/alacritty/keybindings.toml",
      "~/.config/alacritty/themes/theme.toml",
  ]

  [window]
  decorations = "buttonless"
  dynamic_title = true
  opacity = 0.98

  [window.dimensions]
  columns = 170
  lines = 50

  [window.padding]
  x = 5
  y = 7

  [scrolling]
  history = 100000
  multiplier = 3

  [font]
  size = 13.0

  [font.normal]
  family = "FiraCode Nerd Font"
  style = "Regular"

  [font.bold]
  family = "FiraCode Nerd Font"
  style = "Bold"

  [font.italic]
  family = "FiraCode Nerd Font"
  style = "Light"

  [font.bold_italic]
  family = "FiraCode Nerd Font"
  style = "Bold"

  [selection]
  save_to_clipboard = true

  [cursor]
  unfocused_hollow = true

  [cursor.style]
  shape = "Block"
  blinking = "On"

  # Launch Zellij on startup (path from local.nix via homeDirectory)
  [terminal.shell]
  program = "${homeDirectory}/.nix-profile/bin/zellij"
  args = ["attach", "-c", "main"]
''
