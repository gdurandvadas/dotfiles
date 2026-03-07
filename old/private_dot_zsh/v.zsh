#!/bin/zsh

# Function to open directories in code IDE
code_alias() {
    if [[ $# -eq 0 ]]; then
        # No arguments, open current directory
        code .
    elif [[ $# -eq 1 ]]; then
        # One argument, open specified path
        code "$1"
    elif [[ $# -eq 2 ]]; then
        # Two arguments: group and directory
        code "$HOME/Development/$1/$2" && cd "$HOME/Development/$1/$2"
    else
        echo "Usage: v [group] [directory]"
        echo "  v          - Open current directory"
        echo "  v path     - Open specified path"
        echo "  v grp dir  - Open ~/Development/grp/dir"
        return 1
    fi
}

alias v="code_alias"
