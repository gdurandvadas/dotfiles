#!/bin/bash

# ------------------------------------------------+
#             configures fish shell
# ------------------------------------------------+

set -o errexit
set -o pipefail

source "scripts/commons.bash"

if [[ "${SHELL}" != *"bin/fish"* ]]; then
  local shell_path
  shell_path="$(command -v fish)"
  echo $shell_path
  if ! grep "$shell_path" /etc/shells >/dev/null 2>&1; then
    echo "$shell_path" | sudo tee -a /etc/shells
  fi
  sudo chsh -s "$shell_path" "$USER"
fi
