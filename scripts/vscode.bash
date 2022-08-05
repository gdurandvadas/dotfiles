#!/bin/bash

# ------------------------------------------------+
#             configures vscode
# ------------------------------------------------+

set -o errexit
set -o pipefail

EXTENSIONS=(
  "aaron-bond.better-comments"
  "donjayamanne.githistory"
  "eamodio.gitlens"
  "GitHub.github-vscode-theme"
  "golang.go"
  "hashicorp.terraform"
  "jock.svg"
  "ms-azuretools.vscode-docker"
  "ms-kubernetes-tools.vscode-kubernetes-tools"
  "naumovs.color-highlight"
  "streetsidesoftware.code-spell-checker"
  "tal7aouy.icons"
)
source "scripts/commons.bash"

for EXT in "${EXTENSIONS[@]}"; do
  code --install-extension $EXT --force
done
