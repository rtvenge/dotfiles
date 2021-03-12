#!/bin/bash
#All dot files
# source ~/dotfiles/.antigen
source ~/dotfiles/.vars
source ~/dotfiles/.env_vars
source $ZSH/oh-my-zsh.sh
source ~/dotfiles/.alias
source ~/dotfiles/.terminus

# source ~/dotfiles/.iterm2_shell_integration.`basename $SHELL`

fpath=(/usr/local/share/zsh-completions $fpath)

if [ -f ~/dotfiles/.git-completion.zsh ]; then
  . ~/dotfiles/.git-completion.zsh
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
