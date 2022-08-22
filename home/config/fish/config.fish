set -gx XDG_CONFIG_HOME "$HOME/.config"
set -gx XDG_DATA_HOME "$HOME/.local/share"
set -gx XDG_CACHE_HOME "$HOME/.cache"
set -gx EDITOR "/usr/bin/vim"
set -gx TERM "xterm"

if status is-interactive
  # starship
  starship init fish | source

  # asdf
  source (brew --prefix asdf)/libexec/asdf.fish

  if test -e $XDG_CONFIG_HOME/conf.d/colors.fish
    source $XDG_CONFIG_HOME/conf.d/colors.fish
  end

  if test -e $XDG_CONFIG_HOME/conf.d/config.fish.local
    source $XDG_CONFIG_HOME/conf.d/config.fish.local
  end
end
