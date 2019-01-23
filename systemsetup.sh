#!/bin/bash

# Install command line tools
xcode-select --install

#homebrew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# Install needed homebrew packages
~/dotfiles/.brew

#wp-cli
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

#nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.18.0/install.sh | bash

# Install needed node modules
~/dotfiles/.nodemodules

#symlink from dotfiles directory
~/dotfiles/symlink_files.sh

# Disable "last logged in" prompt
touch ~/.hushlogin

brew install fish

# install ohmyzsh
curl -L https://get.oh-my.fish | fish

omf install bobthefish
omf theme bobthefish
