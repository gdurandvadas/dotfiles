#!/bin/zsh

# Git utility functions and aliases
# This script provides functions and aliases to manage Git branches and commits,
# facilitating easier branch cleanup and enforcing conventional commit messages.

# Function to clean local branches that have been merged on remote
clean_merged_branches() {
  git branch --merged | grep -v "\*" | xargs -n 1 git branch -d
}

# Function to perform a conventional commit
conventional_commit() {
  local type
  local title
  local body

  echo "Select the type of change:"
  select type in "feat (new feature)" "fix (bug fix)" "docs (documentation)" "style (formatting)" "refactor (refactoring)" "perf (performance)" "test (testing)" "build (build system)" "ci (CI/CD)" "chore (maintenance)" "revert (revert commit)" "cancel"; do
    if [[ "$type" == "cancel" ]]; then
      echo "Commit cancelled."
      return 1
    elif [[ -n "$type" ]]; then
      # Extract the type keyword from the selection (first word)
      type=$(echo $type | awk '{print $1}')
      break
    else
      echo "Invalid selection. Please try again."
    fi
  done

  echo "Enter the description of the commit (max 50 characters):"
  read title
  if [[ -z "$title" ]]; then
    echo "Description is required. Commit cancelled."
    return 1
  fi

  echo "Enter the body of the commit (optional, press Enter to skip):"
  read body

  local commit_message
  if [[ -n "$body" ]]; then
    commit_message=$(printf "%s: %s\n\n%s" "$type" "$title" "$body")
  else
    commit_message="$type: $title"
  fi

  git commit -m "$commit_message"
}

# Main function to handle 'gt' commands.
# This function supports two subcommands: 'clean' and 'commit'.
# 'clean' allows the user to clean up merged branches.
# 'commit' facilitates creating conventional commits.
gt() {
  local subcommand=$1
  shift # Remove the first argument, leaving any additional arguments for processing

  case "$subcommand" in
  clean)
    local option=$1
    shift
    case "$option" in
    merged)
      clean_merged_branches
      ;;
    *)
      echo "Usage: gt clean {merged}"
      return 1
      ;;
    esac
    ;;
  commit)
    conventional_commit
    ;;
  *)
    echo "Usage: gt {clean|commit} [option]"
    return 1
    ;;
  esac
}

# Alias to call the main function, allowing users to simply type 'gt' to use this utility.
alias gt="gt"
