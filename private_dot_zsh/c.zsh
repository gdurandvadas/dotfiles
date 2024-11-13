#!/bin/zsh

# Function to open directories in Cursor IDE
cursor_alias() {
    if [[ $# -eq 0 ]]; then
        # No arguments, open current directory
        cursor .
    elif [[ $# -eq 1 ]]; then
        # One argument, open specified path
        cursor "$1"
    elif [[ $# -eq 2 ]]; then
        # Two arguments: group and directory
        cursor "$HOME/Development/$1/$2"
    else
        echo "Usage: c [group] [directory]"
        echo "  c          - Open current directory"
        echo "  c path     - Open specified path"
        echo "  c grp dir  - Open ~/Development/grp/dir"
        return 1
    fi
}

alias c="cursor_alias"
