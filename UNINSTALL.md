# Full Nix teardown and 25.11 reinstall

Use this if you need to wipe the Nix stack and reinstall from scratch (e.g. to clear bad state or start clean on 25.11).

## 1. Full uninstall (teardown)

### 1.1 Leave nix-darwin (if you use it)

```bash
# Remove the launchd service and generation symlinks
sudo launchctl unload /Library/LaunchDaemons/org.nixos.darwin-store.plist 2>/dev/null || true
sudo rm -f /Library/LaunchDaemons/org.nixos.*.plist
sudo rm -f /etc/nix/nix.conf
```

### 1.2 Uninstall Nix (multi-user, default on macOS)

From [Nix manual](https://nixos.org/manual/nix/stable/installation/installing-binary.html#uninstalling):

```bash
# Disable the daemon and remove the volume (this deletes /nix)
sudo launchctl unload /Library/LaunchDaemons/org.nixos.nix-daemon.plist 2>/dev/null || true
sudo rm -f /Library/LaunchDaemons/org.nixos.nix-daemon.plist
sudo rm -f /etc/profile.d/nix-daemon.sh

# Remove the Nix volume (deletes entire /nix store)
sudo diskutil apfs deleteVolume "Nix Store" 2>/dev/null || true
# If that fails or you're not on APFS, you may need to manually remove /nix:
# sudo rm -rf /nix
```

### 1.3 Remove per-user Nix/Home Manager state

```bash
rm -rf ~/.nix-profile ~/.nix-channels ~/.nix-defexpr
rm -rf ~/.local/state/nix
rm -rf ~/.local/state/home-manager
rm -rf ~/.config/nix
```

### 1.4 Remove system-level Nix config (if any)

```bash
sudo rm -rf /etc/nix
```

### 1.5 Restart (recommended)

```bash
sudo shutdown -r now
```

After reboot, `which nix` and `nix --version` should fail; `/nix` should be gone.

---

## 2. Fresh install (25.11)

### 2.1 Install Nix (multi-user)

```bash
sh <(curl -L https://nixos.org/nix/install) --daemon
```

Follow the prompts. Then start a **new** shell (or `source ~/.nix-profile/etc/profile.d/nix.sh`) and confirm:

```bash
nix --version
```

### 2.2 Install nix-darwin (if you use the workstation flake)

One-time bootstrap from your dotfiles (run from this repo):

```bash
cd ~/.config/dotfiles
nix run nix-darwin# -- switch --flake .#workstation
```

Subsequent updates:

```bash
darwin-rebuild switch --flake .#workstation
```

### 2.3 Home Manager only (no darwin)

If you only use the `personal` / `work` home-manager configs:

```bash
cd ~/.config/dotfiles
nix run home-manager# -- switch --flake .#personal
# or
nix run home-manager# -- switch --flake .#work
```

---

## 3. If you can’t grant App Management

This repo no longer uses **mac-app-util**, so activation does **not** require System Settings → Privacy & Security → App Management. If you add it back later, you’ll need to grant your terminal (or the app that runs `darwin-rebuild` / `home-manager switch`) access there, or activation will fail with “permission denied when trying to update apps”.
