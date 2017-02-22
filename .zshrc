#!/bin/bash
#All dot files
# source ~/dotfiles/.antigen
source ~/dotfiles/.vars
source ~/dotfiles/.login
source ~/dotfiles/.env_vars
source $ZSH/oh-my-zsh.sh
source ~/dotfiles/.alias

# source ~/dotfiles/.iterm2_shell_integration.`basename $SHELL`

if [ -f ~/dotfiles/.git-completion.zsh ]; then
  . ~/dotfiles/.git-completion.zsh
fi

alias drush='/Applications/DevDesktop/drush/drush'
