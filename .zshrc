#!/bin/bash
# All dot files
# Use `timezsh` to troubleshoot load times
source ~/dotfiles/zsh/.private
source ~/dotfiles/zsh/.vars
source ~/dotfiles/zsh/.env_vars
source $ZSH/oh-my-zsh.sh
source ~/.nvm/nvm.sh
source ~/dotfiles/zsh/.alias
source ~/dotfiles/zsh/.functions
# check if homebrew is installed before sourcing.
if [ -d "/opt/homebrew" ]; then
  source ~/dotfiles/zsh/.fzf.zsh
fi
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
