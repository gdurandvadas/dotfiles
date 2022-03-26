#!/bin/bash

# ------------------------------------------------+
#             configures fish shell
# ------------------------------------------------+

set -o errexit
set -o pipefail

EXTENSIONS=(
  "aaron-bond.better-comments"
  "alefragnani.project-manager"
  "dbaeumer.vscode-eslint"
  "esbenp.prettier-vscode"
  "foxundermoon.shell-format"
  "golang.go"
  "hashicorp.terraform"
  "jock.svg"
  "ms-azuretools.vscode-docker"
  "ms-kubernetes-tools.vscode-kubernetes-tools"
  "naumovs.color-highlight"
  "PKief.material-icon-theme"
  "redhat.vscode-yaml"
  "streetsidesoftware.code-spell-checker"
)
source "scripts/commons.bash"

for EXT in "${EXTENSIONS[@]}"; do
  code --install-extension $EXT --force
done
