# Zsh completion for the z command (project opener).
# Sourced from ~/.zsh on shell init.

_z() {
  local projects_dir="${PROJECTS_DIR:-$HOME/Development}"

  # Arg 1: top-level directories under PROJECTS_DIR
  if (( CURRENT == 2 )); then
    local -a dirs
    dirs=("${projects_dir}"/*(/:t))
    _describe 'project' dirs

  # Arg 2: subdirectories under PROJECTS_DIR/<arg1>
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
