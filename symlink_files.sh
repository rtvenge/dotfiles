#!/bin/bash

files=(
  .hyperterm.js
  .editorconfig
  .eslintrc
  .gitconfig
  .gitignore_global
  .hyperterm_plugins
  .iterm2
  .stylelintrc
  .vimrc
)

for FILE in "${files[@]}"
  do
    :

    # check if file exists
    if [ ! -f ~/dotfiles/${FILE} ]; then
      echo "${FILE} not found in dotfiles. Moving to dotfiles and symlinking…"
      mv ~/${FILE} ~/dotfiles/${FILE}
      ln -s ~/dotfiles/${FILE} ~/${FILE}
    else
      echo "Symlinking ${FILE}"
      rm ~/${FILE}
      ln -s ~/dotfiles/${FILE} ~/${FILE}
    fi

  done
