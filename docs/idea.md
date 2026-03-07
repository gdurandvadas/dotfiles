To build a deterministic, AI-orchestrated development environment for your dotfiles repository, you must combine **Nix Flakes** for system reproducibility, **Home Manager** for Zed's declarative configuration, and **OpenCode's** agentic orchestration.

Below is a comprehensive configuration structure optimized for a polyglot stack (Golang, Rust, TypeScript, and SQL).

---

## 📂 Recommended Directory Structure

Store these files in your dotfiles repository to ensure you can instantiate this entire environment on any machine with a single command.

```text
.
├── flake.nix                 # Entry point for the Nix environment
├── home.nix                  # Main Home Manager configuration
└── config/
    ├── zed/
    │   ├── settings.json     # Zed editor behavior and LSP config
    │   └── keymap.json       # Custom keybindings
    └── opencode/
        ├── config.json       # OpenCode global orchestrator settings
        └── skills/           # Custom agent skills (e.g., Deep Research)
            └── research.md

```

---

## ❄️ 1. The Foundation: `flake.nix`

This file defines the exact versions of Zed, OpenCode, and your language toolchains, ensuring bit-for-bit reproducibility.

```nix
{
  description = "Deterministic AI-Orchestrated Dev Environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { nixpkgs, home-manager, ... }: 
  let
    system = "x86_64-linux"; # Or "aarch64-darwin" for Apple Silicon
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    homeConfigurations."your-username" = home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      modules = [ ./home.nix ];
    };
  };
}

```

---

## 🏠 2. Environment Management: `home.nix`

This module installs your tools and handles the critical "out-of-store" symlink for Zed, allowing the editor to mutate its own settings without Nix blocking it.

```nix
{ pkgs, config, ... }: {
  home.packages = with pkgs; [
    # Orchestrator & Editor
    [cite_start]opencode    # The AI orchestration engine [cite: 19]
    [cite_start]zed-editor  # GPU-accelerated sensory interface [cite: 6]

    # [cite_start]Polyglot Toolchain & LSPs [cite: 25]
    go gopls
    rustup rust-analyzer
    nodejs_20 vtsls
    sqlfluff
    nixd        # Nix syntax evaluation
    [cite_start]direnv      # For nix-direnv integration [cite: 18]
  ];

  # [cite_start]Symlink Zed config out-of-store to keep it mutable [cite: 26]
  xdg.configFile."zed/settings.json".source = 
    config.lib.file.mkOutOfStoreSymlink ./config/zed/settings.json;

  programs.direnv.enable = true;
  programs.direnv.nix-direnv.enable = true;
}

```

---

## 📝 3. The Sensory Interface: `config/zed/settings.json`

Configure Zed to use the **Agent Client Protocol (ACP)** to natively embed OpenCode into the editor surface.

```json
{
  "assistant": {
    "version": "1",
    "provider": {
      "name": "opencode",
      "command": "opencode",
      "args": ["--mode", "acp"] 
    }
  },
  "languages": {
    "Go": { "language_servers": ["gopls"], "format_on_save": "on" },
    "Rust": { "language_servers": ["rust-analyzer"], "binary": { "path": "rust-analyzer" } },
    "TypeScript": { "language_servers": ["vtsls"] }
  },
  "lsp": {
    "rust-analyzer": {
      "initialization_options": { "checkOnSave": { "command": "clippy" } }
    }
  },
  "theme": "One Dark",
  "ui_font_size": 16,
  "buffer_font_size": 14
}

```

---

## 🤖 4. Cognitive Orchestration: `config/opencode/config.json`

Define your **Primary Agents** and their respective permissions. Note the use of `plan` with read-only access for architectural safety.

```json
{
  "agents": {
    "build": {
      "model": "claude-3-5-sonnet",
      "permissions": ["file_write", "bash_execute"],
      "system_prompt": "Focus on TDD and execution."
    },
    "plan": {
      "model": "gpt-4o",
      "permissions": ["file_read"],
      "mode": "architectural_analysis"
    },
    "reviewer": {
      "model": "claude-3-5-sonnet",
      "temperature": 0,
      "permissions": ["read_only"]
    }
  },
  "mcp_servers": {
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "postgres": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres"] }
  }
}

```

---

## 🛠️ 5. Modular Expertise: `config/opencode/skills/research.md`

This is a "Skill" that teaches the agent how to perform deep research via the Model Context Protocol.

```markdown
---
name: deep_research
description: Orchestrates a two-phase investigation using web-traversal tools.
---

# Deep Research Workflow
1.  **Phase 1: Outline** - Generate a structural markdown outline of the topic.
2.  [cite_start]**Phase 2: Crawl** - Spawn background subagents to fetch live documentation via MCP. [cite: 119]
3.  **Synthesis** - Aggregate findings into a `RESEARCH.md` file in the project root.

```

---

To scale your dotfiles repository for a comprehensive environment—including custom scripts, terminal configurations, and multiple system types—you should move to a **Modular Nix Flake** architecture. This approach separates your "system logic" (how tools are installed) from your "static configs" (how tools look and behave).

### 📂 Modular Dotfiles Directory Structure

This hierarchy allows you to manage everything from your shell to your AI-orchestrated editor in a single, version-controlled repository.

```text
.
├── flake.nix              # The entry point for the entire environment
├── hosts/                 # Machine-specific configurations
│   └── workstation.nix    # Your primary dev machine settings
├── modules/               # Reusable blocks of configuration logic
│   ├── zed.nix            # Zed editor setup and out-of-store symlinks
│   ├── opencode.nix       # OpenCode agent roles & sandbox logic
│   ├── terminal.nix       # Zsh/Fish, Starship, and Ghostty/Alacritty
│   └── scripts.nix        # Custom shell scripts managed as Nix packages
├── config/                # Pure configuration files (non-Nix)
│   ├── zed/               # settings.json, keymap.json
│   ├── opencode/          # global config and skills/
│   └── scripts/           # Source code for your custom bash/python scripts
└── default.nix            # Centralized Home Manager module

```

---

### ❄️ 1. The Entry Point: `flake.nix`

This file manages your dependencies and defines your user profile.

```nix
{
  description = "Modular AI-Orchestrated Dotfiles";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, home-manager, ... }: 
  let
    system = "x86_64-linux"; 
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    homeConfigurations."your-username" = home-manager.lib.homeManagerConfiguration {
      inherit pkgs;
      modules = [ ./hosts/workstation.nix ];
    };
  };
}

```

---

### 🛠️ 2. The Multi-Agent Logic: `modules/opencode.nix`

This module defines the OpenCode cognitive engine and enforces **strict sandboxing** to prevent AI agents from accessing sensitive system binaries like SSH while allowing access to Git and search tools.

```nix
{ pkgs, ... }: {
  home.packages = [
    # [cite_start]Wrap OpenCode in a sandbox for safety [cite: 19]
    (pkgs.writeShellScriptBin "opencode-safe" ''
      ${pkgs.bubblewrap}/bin/bwrap \
        --ro-bind /usr /usr \
        --bind $PWD $PWD \
        --unshare-all \
        --share-net \
        ${pkgs.opencode}/bin/opencode "$@"
    '')
  ];

  # [cite_start]Global AI configuration [cite: 58, 174]
  xdg.configFile."opencode/config.json".text = builtins.toJSON {
    agents = {
      build = { model = "claude-3-5-sonnet"; permissions = ["file_write", "bash_execute"]; };
      plan = { model = "gpt-4o"; permissions = ["file_read"]; mode = "architectural_planning"; };
      reviewer = { model = "claude-3-5-sonnet"; temperature = 0; permissions = ["read_only"]; };
    };
  };
}

```

---

### 🖥️ 3. The Visual Interface: `modules/zed.nix`

Zed requires specific handling for **hardware acceleration** and **config mutability**. We use `mkOutOfStoreSymlink` so you can still use Zed's UI to change themes without Nix making the file read-only.

```nix
{ pkgs, config, ... }: {
  home.packages = with pkgs; [
    zed-editor
    # [cite_start]Language Servers for the sensory interface [cite: 25, 32]
    nixd gopls rust-analyzer vtsls sqlfluff
  ];

  # [cite_start]Symlink to the local config folder for mutability [cite: 26]
  xdg.configFile."zed/settings.json".source = 
    config.lib.file.mkOutOfStoreSymlink ../config/zed/settings.json;
    
  xdg.configFile."zed/keymap.json".source = 
    config.lib.file.mkOutOfStoreSymlink ../config/zed/keymap.json;
}

```

---

### 📜 4. Custom Scripts as Nix Packages: `modules/scripts.nix`

Instead of a messy `~/bin`, turn your custom scripts into managed Nix packages that are automatically added to your `$PATH`.

```nix
{ pkgs, ... }: 
let
  # A custom script to initiate an AI research-to-code loop
  ai-init = pkgs.writeShellScriptBin "ai-init" ''
    echo "Initializing AI research phase..."
    opencode-safe --skill deep_research "$1"
    zed .
  '';
in {
  home.packages = [ ai-init ];
}

```

---

### 🎹 5. Polyglot Language Config: `config/zed/settings.json`

Configure how Zed interacts with the orchestrator via the **Agent Client Protocol (ACP)**.

| Language | Server | Key Capability |
| --- | --- | --- |
| **Golang** | `gopls` | Auto-formatting and inlay hints.

 |
| **Rust** | `rust-analyzer` | Real-time macro expansion and borrow checker feedback.

 |
| **TypeScript** | `vtsls` | Superior performance for large generic type resolution.

 |

```json
{
  "assistant": {
    "version": "1",
    "provider": {
      "name": "opencode",
      "command": "opencode-safe",
      "args": ["--mode", "acp"] 
    }
  },
  "languages": {
    "Rust": { "language_servers": ["rust-analyzer"] },
    "Go": { "language_servers": ["gopls"] }
  },
  "terminal": { "font_family": "JetBrainsMono Nerd Font" }
}

```

---

### 🚀 Implementation Strategy

1. 
**Instantiate:** Run `home-manager switch --flake .#your-username` to deploy the entire stack.


2. 
**Project Context:** Use `nix-direnv` in specific directories to load the exact Rust or Go versions required for that project, preventing "environmental drift" that causes AI hallucinations.


3. 
**Skills:** Add new `.md` files to `config/opencode/skills/` to teach your agents new workflows, like automated PR reviews or database schema analysis.
