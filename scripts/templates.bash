#!/bin/bash

# ------------------------------------------------+
#            populate template files
# ------------------------------------------------+

set -o errexit
set -o pipefail

source "scripts/commons.bash"

${HOMEBREW_PREFIX}/bin/envsubst '$HOMEBREW_PREFIX' < templates/tmux.conf > home/tmux.conf
${HOMEBREW_PREFIX}/bin/envsubst '$HOMEBREW_PREFIX' < templates/tmux.yaml > home/config/alacritty/config/tmux.yaml

if test -f "is_job"; then
  export EMAIL="gaston.vadas@mollie.com"
  ${HOMEBREW_PREFIX}/bin/envsubst '$EMAIL' < templates/gitconfig > home/gitconfig
else
  export EMAIL="contact@gedv.me"
  ${HOMEBREW_PREFIX}/bin/envsubst '$EMAIL' < templates/gitconfig > home/gitconfig
fi