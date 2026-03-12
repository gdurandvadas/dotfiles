#!/usr/bin/env bash
#
# Open a project directory in Zed.
# Usage:
#   z <dir>          → opens $PROJECTS_DIR/<dir>
#   z <dir> <subdir> → opens $PROJECTS_DIR/<dir>/<subdir>
#   z                → prints usage and lists top-level dirs

set -euo pipefail

readonly PROJECTS="${PROJECTS_DIR:-$HOME/Development}"

err() {
  echo "$*" >&2
}

usage() {
  echo "Usage: z <dir> [subdir]"
  echo ""
  echo "Opens a project directory in Zed."
  echo "  PROJECTS_DIR=${PROJECTS}"
  echo ""
  echo "Available directories:"
  if [[ -d "${PROJECTS}" ]]; then
    for d in "${PROJECTS}"/*/; do
      [[ -d "${d}" ]] && echo "  $(basename "${d}")"
    done
  else
    err "  (PROJECTS_DIR does not exist: ${PROJECTS})"
  fi
}

main() {
  if (( $# == 0 )); then
    usage
    exit 0
  fi

  local target
  if (( $# == 1 )); then
    target="${PROJECTS}/${1}"
  else
    target="${PROJECTS}/${1}/${2}"
  fi

  if [[ ! -d "${target}" ]]; then
    err "Error: directory does not exist: ${target}"
    exit 1
  fi

  exec zeditor -- "${target}"
}

main "$@"
