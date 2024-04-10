# My Dotfiles Configuration

This repository is dedicated to my personal dotfiles, managed efficiently with [chezmoi](https://www.chezmoi.io/). Chezmoi not only aids in synchronizing and securing the configuration across various machines but also simplifies the process. The following sections outline the necessary setup steps, focusing on terminal configurations and shortcuts.

## Dependencies

The setup necessitates the installation of a few critical dependencies:

- **Xcode**: Essential for macOS users, providing a suite of software development tools by Apple.
- **Rosetta**: Enables running applications with x86_64 instructions on Apple silicon.
- **Homebrew**: The missing package manager for macOS (or Linux), indispensable for installing the required packages.

All package installations are orchestrated through a `packages.yaml` file within the `.chezmoidata` directory, ensuring seamless management and updates.

## Terminal Configuration

The configuration harnesses `/bin/zsh` as the default shell, employs `alacritty` as the terminal emulator, and utilizes `tmux` for terminal multiplexing. Enhanced with the `gruvbox` color scheme, this setup also integrates `Starship`, a snappy shell prompt, for an aesthetically pleasing and functional terminal experience.

- **Zsh**: An advanced shell offering numerous improvements over its predecessors. [More about Zsh](https://support.apple.com/en-gb/102360).
- **Alacritty**: A GPU-accelerated terminal emulator known for its performance and simplicity. [Learn about Alacritty](https://alacritty.org/).
- **Tmux**: Allows for managing multiple terminal sessions within a single window, increasing productivity. [Explore Tmux](https://github.com/tmux/tmux/wiki).
- **Starship**: A fast, customizable prompt for any shell that keeps you productive at the command line. [Discover Starship](https://starship.rs/).

## Terminal Shortcuts

To enhance your workflow, we've included a series of keyboard shortcuts, particularly useful when working within tmux. Below is a table detailing these shortcuts:

| Key Combination               | Action                                          |
| ----------------------------- | ----------------------------------------------- |
| `Cmd` + `Shift` + `R`         | Reload tmux configuration                       |
| `Alt` + `Right`               | Jump to the next word                           |
| `Alt` + `Left`                | Jump to the previous word                       |
| `Cmd` + `D`                   | Split tmux pane horizontally                    |
| `Cmd` + `Shift` + `D`         | Split tmux pane vertically                      |
| `Cmd` + `Shift` + `Arrow Key` | Navigate between tmux panes                     |
| `Cmd` + `S`                   | Synchronize command input across all tmux panes |
| `Cmd` + `T`                   | Create a new tmux window                        |
| `Cmd` + `W`                   | Close the current tmux window                   |
| `Cmd` + `1` to `Cmd` + `0`    | Select tmux window by number                    |
| `Cmd` + `Arrow Up`            | Search up for substring in the terminal         |
| `Cmd` + `Arrow Down`          | Search down for substring in the terminal       |
