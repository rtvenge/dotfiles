-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- PHP language server. Zed runs phpcs + emmet and explicitly disables phpactor
-- ("!phpactor"), so use intelephense here instead of LazyVim's phpactor default.
vim.g.lazyvim_php_lsp = "intelephense"

-- Zed: "format_on_save": "off" (PHP re-enables it per-buffer, see autocmds.lua).
-- Toggle for the current buffer any time with <leader>uf.
vim.g.autoformat = false

-- Zed: "show_whitespaces": "all". Drop the `space` entry for trailing-only markers.
vim.opt.list = true
vim.opt.listchars = { tab = "» ", space = "·", trail = "·", nbsp = "␣" }

-- Zed: "file_types": { "PHP": ["**/*.inc", "**/*.theme", "**/*.module"] }.
-- Neovim guesses `.module` as virata and `.inc` as pov, so Drupal files need this.
vim.filetype.add({
  extension = {
    inc = "php",
    module = "php",
    theme = "php",
    -- nunjucks has no treesitter parser; htmldjango is the closest built-in
    njk = "htmldjango",
  },
})
