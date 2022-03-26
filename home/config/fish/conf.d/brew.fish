if test -d /opt/homebrew
  eval (/opt/homebrew/bin/brew shellenv)
else
  eval (/usr/local/bin/brew shellenv)
end