#!/bin/bash

# Install command line tools
xcode-select --install

#homebrew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# Install needed homebrew packages
~/dotfiles/.brew

#rvm for ruby docs: http://rvm.io/rvm/install
# ??? gpg --keyserver hkp://keys.gnupg.net --recv-keys D39DC0E3
curl -sSL https://get.rvm.io | bash -s stable

#wp-cli
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

#nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.18.0/install.sh | bash

# Symlink dotfiles directory from Dropbox
ln -s ~/Dropbox/app\ settings/dotfiles dotfiles

# Install needed node modules
~/dotfiles/.nodemodules

# Install needed Ruby Gems
~/dotfiles/.gems

#symlink from dotfiles directory
ln -s ~/Dropbox/app\ settings/dotfiles/.zshrc .zshrc
ln -s ~/Dropbox/app\ settings/dotfiles/.gitconfig .gitconfig
ln -s ~/Dropbox/app\ settings/dotfiles/.gitignore_global .gitignore_global

# Disable "last logged in" prompt
touch ~/.hushlogin

# install ohmyzsh
curl -L http://install.ohmyz.sh | sh
# subl command
ln -s /Applications/Sublime\ Text.app/Contents/SharedSupport/bin/subl /usr/local/bin/subl