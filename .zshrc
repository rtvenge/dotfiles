#!/bin/bash
# All dot files
# Use `timezsh` to troubleshoot load times
source ~/dotfiles/.private
source ~/dotfiles/.vars
source ~/dotfiles/.env_vars
source $ZSH/oh-my-zsh.sh
source ~/dotfiles/.alias
source ~/dotfiles/.functions

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
