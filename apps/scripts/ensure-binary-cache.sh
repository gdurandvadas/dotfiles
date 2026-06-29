#!/usr/bin/env bash
# Refuse dotfiles switch/update when nixpkgs packages would compile locally.
# Home Manager's own small wrapper derivations are expected and allowed.

is_allowed_local_build() {
  local name="$1"
  case "$name" in
    activation-script | \
      cleanup | \
      link | \
      dotfiles | \
      options.json | \
      check-link-targets.sh | \
      install-shell-files | \
      home-manager | \
      home-manager-* | \
      home-configuration-reference-manpage | \
      hm-switch | \
      hm_* | \
      hm-*)
      return 0
      ;;
  esac
  return 1
}

ensure_binary_cache_switch() {
  local dotfiles_dir="${1:?dotfiles dir required}"
  local profile="${2:-personal}"
  local context="${3:-dotfiles}"
  local dry_run_log

  dry_run_log="$(mktemp)"
  trap 'rm -f "$dry_run_log"' RETURN

  echo "Checking whether the configuration can be applied from binary caches..."
  if ! nix build "$dotfiles_dir#homeConfigurations.${profile}.activationPackage" \
    --impure \
    --dry-run \
    2>&1 | tee "$dry_run_log"; then
    echo "$context: dry-run failed; not switching." >&2
    return 1
  fi

  local local_builds=()
  while IFS= read -r drv; do
    local name
    name="$(basename "$drv" .drv)"
    name="${name#*-}"
    if ! is_allowed_local_build "$name"; then
      local_builds+=("$name")
    fi
  done < <(awk '/^[[:space:]]+\/nix\/store\/.*\.drv$/ { print $1 }' "$dry_run_log")

  if [[ "${#local_builds[@]}" -gt 0 ]]; then
    echo "" >&2
    echo "$context: refusing to compile packages locally." >&2
    echo "The current lock file has no binary substitute for:" >&2
    printf '  - %s\n' "${local_builds[@]}" >&2
    echo "" >&2
    echo "Try again later, update fewer inputs, or pin nixpkgs to a cached revision." >&2
    return 1
  fi

  if grep -q 'Using mismatched versions' "$dry_run_log"; then
    echo "" >&2
    echo "$context: refusing to apply a Home Manager / Nixpkgs release mismatch." >&2
    echo "Update nixpkgs together with home-manager, or wait for cached binaries." >&2
    return 1
  fi
}
