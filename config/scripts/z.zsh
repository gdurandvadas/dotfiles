# Open a project directory in Zed and cd into it.
# Usage:
#   z <dir>          → opens and cd's into $PROJECTS_DIR/<dir>
#   z <dir> <subdir> → opens and cd's into $PROJECTS_DIR/<dir>/<subdir>
#   z                → prints usage and lists top-level dirs

z() {
  local projects="${PROJECTS_DIR:-$HOME/Development}"

  if (( $# == 0 )); then
    echo "Usage: z <dir> [subdir]"
    echo ""
    echo "Opens a project directory in Zed and cd's into it."
    echo "  PROJECTS_DIR=${projects}"
    echo ""
    echo "Available directories:"
    if [[ -d "${projects}" ]]; then
      for d in "${projects}"/*/; do
        [[ -d "${d}" ]] && echo "  $(basename "${d}")"
      done
    else
      echo "  (PROJECTS_DIR does not exist: ${projects})" >&2
    fi
    return 0
  fi

  local target
  if (( $# == 1 )); then
    target="${projects}/${1}"
  else
    target="${projects}/${1}/${2}"
  fi

  if [[ ! -d "${target}" ]]; then
    echo "Error: directory does not exist: ${target}" >&2
    return 1
  fi

  cd "${target}" && zeditor -- "${target}"
}

_z() {
  local projects_dir="${PROJECTS_DIR:-$HOME/Development}"

  if (( CURRENT == 2 )); then
    local -a dirs
    dirs=("${projects_dir}"/*(/:t))
    _describe 'project' dirs
  elif (( CURRENT == 3 )); then
    local parent="${projects_dir}/${words[2]}"
    if [[ -d "${parent}" ]]; then
      local -a subdirs
      subdirs=("${parent}"/*(/:t))
      _describe 'subdir' subdirs
    fi
  fi
}

compdef _z z
