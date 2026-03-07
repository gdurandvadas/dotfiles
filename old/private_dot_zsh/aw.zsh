#!/bin/zsh

# AWS utility functions and aliases
# This script provides functions and aliases to manage AWS profiles and regions,
# facilitating easier switching between different AWS profiles and setting default regions,
# especially useful for users frequently working with AWS SSO.

# Function to get the list of profiles from ~/.aws/config
# It filters out profiles that should not be listed, such as those with 'AWSAdministratorAccess'
# or commented-out profiles.
get_aws_profiles() {
  # Use awk to parse the AWS config file, extracting profile names while excluding
  # profiles with 'AWSAdministratorAccess' and comments.
  awk -F'[][]' '/profile/ && !/AWSAdministratorAccess/ && !/#/ {gsub(/^[ \t]+|[ \t]+$/, "", $2); gsub(/profile /, "", $2); print $2}' ~/.aws/config
}

# Function to list AWS profiles and allow the user to select one to set as the default.
# This function uses the select command in the shell to generate a menu of profiles.
# If the user selects 'cancel', the function exits without changing the AWS profile.
select_aws_profile() {
  local profiles=($(get_aws_profiles)) # Retrieve the list of profiles
  local profile

  echo "Select an AWS profile (or 'cancel' to exit):"
  select profile in "${profiles[@]}" "cancel"; do
    if [[ "$profile" == "cancel" ]]; then
      echo "Profile selection cancelled."
      return 1
    elif [[ -n "$profile" ]]; then
      export AWS_PROFILE="$profile" # Set the selected profile as the current AWS profile
      echo "AWS profile set to '$AWS_PROFILE'"
      aws sso login # Initiate SSO login for the selected profile
      return 0
    else
      echo "Invalid selection. Please try again."
    fi
  done
}

# Main function to handle 'aw' commands.
# This function supports two subcommands: 'login' and 'set-region'.
# 'login' allows the user to log in to AWS SSO with a specified profile or choose from a list.
# 'set-region' sets the default AWS region for commands.
aws_cli_alias() {
  local subcommand=$1
  shift # Remove the first argument, leaving any additional arguments for processing

  case "$subcommand" in
    login)
      if [ -n "$1" ]; then
        export AWS_PROFILE="$1" # Directly set the AWS_PROFILE if provided as an argument
        echo "AWS profile set to '$AWS_PROFILE'"
        aws sso login # Initiate SSO login
      else
        if ! select_aws_profile; then # Show profile selection if no profile argument is provided
          return 1
        fi
      fi
      ;;
    set-region)
      if [ -n "$1" ]; then
        export AWS_DEFAULT_REGION="$1" # Set the specified region as the default AWS region
        echo "AWS default region set to '$AWS_DEFAULT_REGION'"
      else
        echo "Usage: aw set-region <region>" # Show usage if no region argument is provided
        return 1
      fi
      ;;
    *)
      echo "Usage: aw {login|set-region} [profile|region]" # Default case if an unknown subcommand is provided
      ;;
  esac
}

# Alias to call the main function, allowing users to simply type 'aw' to use this utility.
alias aw="aws_cli_alias"
