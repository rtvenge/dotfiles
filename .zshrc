# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

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
