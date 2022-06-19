#!/bin/bash

# --------------------------------------------------+
#           installs brew and packages
# --------------------------------------------------+

set -o errexit
set -o pipefail

source "scripts/commons.bash"

if ! command -v ${HOMEBREW_PREFIX}/bin/brew; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(${HOMEBREW_PREFIX}/bin/brew shellenv)"

if test -f "is_job"; then
  brew bundle install --file templates/Brewfile.job
else
  brew bundle install --file templates/Brewfile.personal
fi
