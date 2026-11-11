# Dotfiles

This repo is linked into `~` with GNU Stow. The repo mirrors the home directory:
`.zshrc` here is `~/.zshrc`, `.config/nvim` is `~/.config/nvim`.

## Linking a config

Never create links by hand with `ln -s`. To put a config under version control:

1. Move it into the repo at its home-relative path (`~/.config/foo` → `.config/foo`).
2. Dry run, and show the user the result: `stow -n -v -d ~/dotfiles -t ~ .`
3. Link: `stow -v -d ~/dotfiles -t ~ .`

If Stow reports a conflict with a real file in `~`, ask the user which version to
keep; don't overwrite it. A conflict on an absolute symlink ("not owned by stow")
just means an old hand-made link: remove it and re-run.

Anything that should stay in the repo only (scripts, notes, files read from
`~/dotfiles/...` by path) goes in `.stow-local-ignore`. That file replaces Stow's
built-in ignore list, so keep `.git` and friends in it.

The one exception is espanso: macOS reads it from `~/Library/Preferences/espanso`,
which `bin/systemsetup.sh` links by hand.

This repo is also used on a Raspberry Pi (Linux), so keep shell config portable.
