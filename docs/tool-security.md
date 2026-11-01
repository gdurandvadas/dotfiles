# Direct-tool security review

Reviewed on 2026-11-01. Versions below describe this workstation at the start of the review,
not versions pinned by this repository. Homebrew and upstream app updaters can change them.

## Scope and method

Compare the directly selected Homebrew tools and bootstrap managers with their maintainers'
published security advisories. Read all pages of each GitHub repository's published advisories
through `gh api --paginate repos/OWNER/REPO/security-advisories?per_page=100`, excluding withdrawn
entries. For proprietary apps, use vendor security notices and release notes. Use installed
Homebrew receipts for CLI versions and application Info.plist files for actual GUI versions;
self-updating apps can be newer than their Homebrew receipts.

Excluded: mise-installed runtimes and infrastructure tools, IDE-managed extensions, language
server packages, transitive libraries, and unrelated applications outside this configuration.
For example, review mise itself rather than the Go version it installs. This is an advisory
review, not a binary scan or proof that a tool has no vulnerabilities. Missing advisories and
unpublished vulnerabilities remain coverage gaps.

## Findings requiring action

| Tool | Observed version | Finding | Minimum remediation |
| --- | --- | --- | --- |
| Determinate Nix | 3.17.0 (upstream Nix 2.33.3) | Confirmed critical sandbox escape, CVE-2026-39860 | Determinate 3.17.3 fixes this issue; update to the latest vendor-advised version for subsequent fixes |
| mise | 2026.6.14 | High-severity project trust and signature-verification bypasses; token disclosure | 2026.10.14 covers the newest reviewed advisory; prefer current stable |
| GitHub CLI | 2.95.0 | Command execution via malicious Codespaces; symlink writes outside destinations; terminal injection and attestation issues | 2.102.0 covers the reviewed advisories |
| fzf | 0.73.1 | High-severity shell command injection in fzf-tmux; predictable FIFO in Zsh completion | 0.74.5 |
| Starship | 1.26.0 | Git repository ownership checks bypassed; symlink-triggered resource exhaustion | 1.27.0 |
| 1Password CLI | 2.34.1 | Later releases contain bundled Go/crypto security fixes; exploitability in this installation was not established | Update to current stable (2.41.1 at review) |

Sources and applicability:

- **Nix:** [Determinate 3.17.3 security release](https://determinate.systems/blog/changelog-determinate-nix-3-17-3/)
  explicitly identifies all older Determinate versions as affected. Upstream also publishes
  [additional advisories](https://github.com/NixOS/nix/security/advisories), including October
  2026 fixes. A flake input update cannot patch this installation: `nix.enable = false` leaves
  the bootstrap daemon under Determinate's management. Its fork needs vendor-specific checking;
  upstream version numbers alone cannot establish which fixes were backported.
- **mise:** [PATH trust bypass](https://github.com/jdx/mise/security/advisories/GHSA-43hx-4j66-v486),
  [attestation identity spoofing](https://github.com/jdx/mise/security/advisories/GHSA-r9rm-ppfv-c993),
  [cosign identity bypass](https://github.com/jdx/mise/security/advisories/GHSA-fh4m-2w73-96r9),
  [shell-interpreter trust bypass](https://github.com/jdx/mise/security/advisories/GHSA-g74g-rg72-j2p3),
  and [token disclosure](https://github.com/jdx/mise/security/advisories/GHSA-wcqh-j26q-g44x).
  The installed release falls in these affected ranges. The root install.sh ownership advisory
  does not describe this Homebrew installation; the September-only history setting regression
  does not match the installed version. Earlier advisories with open-ended ranges were assessed
  against their stated patched release rather than treating every newer release as vulnerable.
- **gh:** [command execution](https://github.com/cli/cli/security/advisories/GHSA-8cg3-r6g9-fpg2),
  [symlink writes](https://github.com/cli/cli/security/advisories/GHSA-39wj-f2f4-978v),
  and the remaining [published advisories](https://github.com/cli/cli/security/advisories).
  Exploitation depends on the affected command and untrusted input.
- **fzf:** [fzf-tmux injection](https://github.com/junegunn/fzf/security/advisories/GHSA-w6x2-f5m4-xw82)
  and [Zsh FIFO vulnerability](https://github.com/junegunn/fzf/security/advisories/GHSA-7rj6-7pqx-v7rm).
  Zsh's fzf integration is enabled here; the tmux helper is not explicitly configured.
- **Starship:** [Git ownership bypass](https://github.com/starship/starship/security/advisories/GHSA-679r-jwc5-r5m3)
  and [metadata symlink handling](https://github.com/starship/starship/security/advisories/GHSA-x486-6jjc-phfp).
- **1Password CLI:** [vendor release notes](https://releases.1password.com/developers/cli/).
  This concerns the CLI's bundled dependencies, not the mise-managed Go installation.

## Remaining inventory

“No matching advisory” means no applicable issue found in the reviewed source, not a guarantee.

| Tool | Observed version | Review result and source |
| --- | --- | --- |
| Homebrew | 7.0.11 | Meets the newest published fixed version in [Homebrew advisories](https://github.com/Homebrew/brew/security/advisories) |
| Git | 2.54.0 | Beyond affected release ranges in [Git advisories](https://github.com/git/git/security/advisories) |
| jq | 1.8.2 | Includes the reviewed 1.8.2 fixes in [jq advisories](https://github.com/jqlang/jq/security/advisories) |
| eza | 0.23.4 | Beyond the affected AArch64 range below 0.18.2 in [eza advisories](https://github.com/eza-community/eza/security/advisories) |
| Protobuf compiler | 35.1 | No matching compiler issue in [Protobuf advisories](https://github.com/protocolbuffers/protobuf/security/advisories); most entries concern runtime libraries |
| cloudflared | 2026.6.1 | Beyond the affected ranges in [cloudflared advisories](https://github.com/cloudflare/cloudflared/security/advisories) |
| Codex CLI | 0.142.4 | Beyond 0.39.0, the fixed CLI version in [Codex advisories](https://github.com/openai/codex/security/advisories) |
| Zed | 1.26.2 | Beyond affected ranges in all 12 [published Zed advisories](https://github.com/zed-industries/zed/security/advisories) |
| Brave | 1.98.63 | Matches the [current stable release](https://github.com/brave/brave-browser/releases/tag/v1.98.63); includes Chromium security updates |
| 1Password for Mac | 8.12.40 | Current stable is 8.12.42; no matching app vulnerability established from [vendor release notes](https://releases.1password.com/mac/stable/); update through the app |
| ChatGPT | 26.1016.51333 | Vendor-managed desktop application; release freshness alone cannot establish absence of vulnerabilities |
| ripgrep | 15.2.0 | No published repository advisories in [reviewed source](https://github.com/BurntSushi/ripgrep/security/advisories) |
| fd | 10.4.2 | No published repository advisories in [reviewed source](https://github.com/sharkdp/fd/security/advisories) |
| bat | 0.26.1 | No published repository advisories in [reviewed source](https://github.com/sharkdp/bat/security/advisories) |
| yq | 4.53.3 | No published repository advisories in [reviewed source](https://github.com/mikefarah/yq/security/advisories) |
| Zellij | 0.44.3 | No published repository advisories in [reviewed source](https://github.com/zellij-org/zellij/security/advisories) |
| Pulumi | 3.248.0 | No published repository advisories in [reviewed source](https://github.com/pulumi/pulumi/security/advisories) |
| wasm-pack | 0.15.0 | No published repository advisories in [reviewed source](https://github.com/drager/wasm-pack/security/advisories) |
| direnv | 2.37.1 | No published repository advisories in [reviewed source](https://github.com/direnv/direnv/security/advisories) |
| Alacritty | 0.17.0 | No published repository advisories in [reviewed source](https://github.com/alacritty/alacritty/security/advisories) |
| zsh-autosuggestions | 0.7.1 | No published repository advisories in [reviewed source](https://github.com/zsh-users/zsh-autosuggestions/security/advisories) |
| zsh-syntax-highlighting | 0.8.0 | No published repository advisories in [reviewed source](https://github.com/zsh-users/zsh-syntax-highlighting/security/advisories) |
| Fira Code Nerd Font | 3.4.0 | No published repository advisories in [reviewed source](https://github.com/ryanoasis/nerd-fonts/security/advisories) |

## Updating and verifying

Use each tool's owning manager. These commands do not upgrade mise-managed toolchains:

```sh
brew update
brew upgrade mise gh fzf starship
brew upgrade --cask 1password-cli
sudo determinate-nixd upgrade
```

Update GUI applications through their own updaters. Verify CLI versions after updating and
repeat the advisory comparison; an outdated-package check alone is not a vulnerability scan.
Homebrew's `brew audit` checks formula/cask definitions and is not a CVE scanner.
