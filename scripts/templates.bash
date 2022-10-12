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
  ${HOMEBREW_PREFIX}/bin/envsubst '$ONE_PASSWORD_SSH_CONFIG' < templates/ssh-config > home/ssh/config
else
  export EMAIL="contact@gedv.me"
  ${HOMEBREW_PREFIX}/bin/envsubst '$EMAIL' < templates/gitconfig > home/gitconfig
  export ONE_PASSWORD_SSH_CONFIG=$(echo -e "Host *\n  UseKeychain yes\n  IdentityAgent ~/.1password/agent.sock")
  ${HOMEBREW_PREFIX}/bin/envsubst '$ONE_PASSWORD_SSH_CONFIG' < templates/ssh-config > home/ssh/config
fi