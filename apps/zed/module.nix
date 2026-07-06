{ config, ... }:
let
  zedDownloadEndpoint =
    "https://cloud.zed.dev/releases/stable/latest/asset?asset=zed&os=macos&arch=aarch64";
in {
  # Zed is installed from upstream binary via home.activation below.
  # LSP servers (gopls, rust-analyzer, etc.) are managed by the IDE automatically.

  xdg.configFile."zed/settings.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/apps/zed/settings.json";
    force = true;
  };
  xdg.configFile."zed/keymap.json" = {
    source =
      config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/.config/dotfiles/apps/zed/keymap.json";
    force = true;
  };

  home.activation.zed-binary = config.lib.dag.entryAfter [ "writeBoundary" ] ''
    if [[ "$(uname -s)" = "Darwin" ]]; then
      app_dir="$HOME/Applications"
      user_app_path="$app_dir/Zed.app"
      system_app_path="/Applications/Zed.app"
      app_path="$user_app_path"
      bin_dir="$HOME/.local/bin"
      jq_bin="$(command -v jq || true)"

      if [[ -z "$jq_bin" ]]; then
        echo "Zed binary install skipped: jq is not available yet." >&2
        exit 0
      fi

      latest_json="$(/usr/bin/curl -fsSL "${zedDownloadEndpoint}" || true)"
      latest_version="$(printf '%s' "$latest_json" | "$jq_bin" -r '.version // empty' 2>/dev/null || true)"
      download_url="$(printf '%s' "$latest_json" | "$jq_bin" -r '.url // empty' 2>/dev/null || true)"

      installed_version=""
      if [[ -d "$user_app_path" ]]; then
        app_path="$user_app_path"
      elif [[ -d "$system_app_path" ]]; then
        app_path="$system_app_path"
      fi

      if [[ -f "$app_path/Contents/Info.plist" ]]; then
        installed_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app_path/Contents/Info.plist" 2>/dev/null || true)"
      fi

      if [[ -n "$download_url" && "$installed_version" != "$latest_version" ]]; then
        echo "Installing Zed.app $latest_version from upstream binary..."
        tmpdir="$(mktemp -d)"
        mkdir -p "$tmpdir/mnt" "$app_dir"
        app_path="$user_app_path"

        if /usr/bin/curl -fL "$download_url" -o "$tmpdir/Zed.dmg" \
          && /usr/bin/hdiutil attach "$tmpdir/Zed.dmg" -nobrowse -readonly -mountpoint "$tmpdir/mnt" >/dev/null \
          && [[ -d "$tmpdir/mnt/Zed.app" ]]; then
          rm -rf "$app_path"
          ditto "$tmpdir/mnt/Zed.app" "$app_path"
          /usr/bin/hdiutil detach "$tmpdir/mnt" >/dev/null || true
        else
          /usr/bin/hdiutil detach "$tmpdir/mnt" >/dev/null 2>&1 || true
          echo "Zed binary install failed; leaving existing app untouched." >&2
        fi

        rm -rf "$tmpdir"
      fi

      if [[ -x "$app_path/Contents/MacOS/zed" ]]; then
        mkdir -p "$bin_dir"
        ln -sfn "$app_path/Contents/MacOS/zed" "$bin_dir/zed"
      fi
    fi
  '';
}
