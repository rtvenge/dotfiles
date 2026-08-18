#!/bin/bash
# All dot files
# Use `timezsh` to troubleshoot load times
source ~/dotfiles/zsh/.private
source ~/dotfiles/zsh/.env_vars
source ~/dotfiles/zsh/.vars
source $ZSH/oh-my-zsh.sh
source ~/dotfiles/zsh/.alias
source ~/dotfiles/zsh/.functions
# check if homebrew is installed before sourcing.
if [ -d "/opt/homebrew" ]; then
  source ~/dotfiles/zsh/.fzf.zsh
fi
