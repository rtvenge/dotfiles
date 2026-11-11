DotFiles
========

A collection of dot files used on my computer.

Files are linked into the home directory with [GNU Stow](https://www.gnu.org/software/stow/). The repo mirrors `~`, so `.zshrc` links to `~/.zshrc` and `.config/nvim` to `~/.config/nvim`:

```sh
stow -d ~/dotfiles -t ~ .        # link (safe to re-run)
stow -n -v -d ~/dotfiles -t ~ .  # dry run: show what it would do
```

To add something, put it at its home-relative path in the repo and re-run stow. Anything that should stay in the repo only goes in `.stow-local-ignore`.

The one exception is espanso, which macOS reads from `~/Library/Preferences/espanso`. `bin/systemsetup.sh` links that by hand.
