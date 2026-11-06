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

# >>> agent-resume >>>
# Agent resume (herdr-agent-resume): a restored Herdr terminal starts its agent again.
# Set AGENT_RESUME_AUTO=0 to pause it; `install.py --no-auto` removes these lines.
if [[ -o interactive && -n "$HC_TERMINAL_ID" ]]; then
    __agent_resume() {
        add-zsh-hook -d precmd __agent_resume
        unfunction __agent_resume
        if [[ "$AGENT_RESUME_AUTO" != 0 && -f '/Users/ryantvenge/dotfiles/.config/herdr-app/mods/agent-resume/agent_resume.py' ]]; then
            command python3 '/Users/ryantvenge/dotfiles/.config/herdr-app/mods/agent-resume/agent_resume.py' here || command python3 '/Users/ryantvenge/dotfiles/.config/herdr-app/mods/agent-resume/agent_resume.py' after $?
        fi
    }
    autoload -Uz add-zsh-hook && add-zsh-hook precmd __agent_resume
fi
# <<< agent-resume <<<
