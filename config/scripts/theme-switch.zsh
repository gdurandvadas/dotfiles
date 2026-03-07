# Sync terminal theme with macOS appearance (dark/light).
# Sourced from ~/.zsh on shell init. Same ln -sf trick for Alacritty and Starship.
# Alacritty: themes/theme.toml -> alacritty_dark.toml (mocha) or alacritty_light.toml (frappe)
# Starship:  ~/.config/starship.toml -> starship_dark.toml (mocha) or starship_light.toml (frappe)

_theme_switch() {
  local is_dark
  is_dark=$(osascript -e 'tell application "System Events" to get dark mode of appearance preferences' 2>/dev/null) || true

  if [[ "$is_dark" == true ]]; then
    print "Switching to dark mode"
  else
    print "Switching to light mode"
  fi

  local alacritty_themes="$HOME/.config/alacritty/themes"
  local starship_dir="$HOME/.config/starship"
  local starship_default="$HOME/.config/starship.toml"

  if [[ -d "$alacritty_themes" ]]; then
    if [[ "$is_dark" == true ]]; then
      ln -sf alacritty_dark.toml "$alacritty_themes/theme.toml" 2>/dev/null || true
    else
      ln -sf alacritty_light.toml "$alacritty_themes/theme.toml" 2>/dev/null || true
    fi
  fi

  if [[ -d "$starship_dir" ]]; then
    if [[ "$is_dark" == true ]]; then
      ln -sf "$starship_dir/starship_dark.toml" "$starship_default" 2>/dev/null || true
    else
      ln -sf "$starship_dir/starship_light.toml" "$starship_default" 2>/dev/null || true
    fi
  fi
}

_theme_switch
unfunction _theme_switch
