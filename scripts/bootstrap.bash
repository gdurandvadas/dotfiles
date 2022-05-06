#!/bin/bash

# --------------------------------------------------------+
#         installs basic software dependencies
# --------------------------------------------------------+

set -o errexit
set -o pipefail

DONE="bootstrap_done"
source "scripts/commons.bash"

if ! test -f "${SOURCE}/${DONE}"; then
  if ! xcode-select -p >/dev/null; then
    xcode-select --install
    wait
  fi

  if [[ "${IS_ARM}" == "true" ]]; then
    if /usr/bin/pgrep oahd >/dev/null 2>&1; then
      echo "Rosetta is already installed and running. Nothing to do."
    else
      /usr/sbin/softwareupdate --install-rosetta --agree-to-license
      wait
    fi
  fi

  touch "${SOURCE}/${DONE}"
fi
