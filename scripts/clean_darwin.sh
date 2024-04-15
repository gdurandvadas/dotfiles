#!/bin/bash

set -o errexit
set -o pipefail

/opt/homebrew/bin/brew remove --force $(/opt/homebrew/bin/brew list --formula)
/opt/homebrew/bin/brew remove --cask --force $(/opt/homebrew/bin/brew list)
sudo rm -rfv ~/.asdf
rm -rfv ~/.zsh ~/.oh-my-zh ~/.config ~/.zshrc
