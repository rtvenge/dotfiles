date '+%A %m.%d.%y'

#########################
# Environment Variables #
#########################

# WP-CLI directory
export PATH="$HOME/.wp-cli/bin:$PATH"
export PATH="/usr/local/sbin:$PATH"
export PATH="/usr/local/bin:$PATH"
export PATH="$PATH:$HOME/.rvm/bin" # Add RVM to PATH for scripting
export PATH="$PATH:/Applications/DevDesktop/mysql/bin"
export PATH="$PATH:/Users/ryantvenge/vendor/bin:$PATH"
export EDITOR="/usr/local/bin/vim"
export NVM_DIR="$HOME/.nvm"
export PATH="$HOME/.composer/vendor/bin:$PATH"
# [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Because of bug in bobthefish
set -g theme_git_worktree_support no

source $HOME/.config/fish/private.fish