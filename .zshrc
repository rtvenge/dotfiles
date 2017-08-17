#!/bin/bash
#All dot files
# source ~/dotfiles/.antigen
source ~/dotfiles/.vars
source ~/dotfiles/.login
source ~/dotfiles/.env_vars
source $ZSH/oh-my-zsh.sh
source ~/dotfiles/.alias

# source ~/dotfiles/.iterm2_shell_integration.`basename $SHELL`

fpath=(/usr/local/share/zsh-completions $fpath)

if [ -f ~/dotfiles/.git-completion.zsh ]; then
  . ~/dotfiles/.git-completion.zsh
fi

# Add RVM to PATH for scripting. Make sure this is the last PATH variable change.
export PATH="$PATH:$HOME/.rvm/bin"
