#!/bin/bash

# Install command line tools
xcode-select --install

#homebrew
ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# `brew leaves > ~/dotfiles/brew/leaves.txt` to update file
xargs brew install <~/dotfiles/brew/leaves.txt

git clone https://github.com/bobthecow/git-flow-completion ~/.oh-my-zsh/custom/plugins/git-flow-completion

#nvm
curl https://raw.githubusercontent.com/creationix/nvm/v0.18.0/install.sh | bash

#symlink from dotfiles directory (.stow-local-ignore lists what stays out of ~)
stow -d "$HOME/dotfiles" -t "$HOME" .
# espanso's config lives outside ~ mirroring on macOS, so it's linked by hand
if [ "$(uname)" = Darwin ]; then
  mkdir -p "$HOME/Library/Preferences"
  ln -sfn "$HOME/dotfiles/espanso" "$HOME/Library/Preferences/espanso"
fi

# Install OMZ
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
