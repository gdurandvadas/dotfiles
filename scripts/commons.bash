#!/bin/bash

# -----------------------------------------------------------------------------------+
#       Contains system data and common variables used across all othe scripts
# -----------------------------------------------------------------------------------+

set -o errexit
set -o pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNAME_MACHINE="$(/usr/bin/uname -m)"
IS_ARM="false"
HOMEBREW_PREFIX="/usr/local"

if [[ "${UNAME_MACHINE}" == "arm64" ]]; then
  HOMEBREW_PREFIX="/opt/homebrew"
  IS_ARM="true"
fi
