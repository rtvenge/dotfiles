require('plugins.lazy')
require('plugins.telescope')
require('plugins.treesitter')
require('plugins.nvim-tree')
require('plugins.which-key')
require('plugins.mason')
require('plugins.cmp')
require('keymaps')
require('options')
require('lsp')

local highlight_group = vim.api.nvim_create_augroup('YankHighlight', { clear = true })
vim.api.nvim_create_autocmd('TextYankPost', {
  callback = function()
    vim.highlight.on_yank()
  end,
  group = highlight_group,
  pattern = '*',
})

-- Setup neovim lua configuration
require('neodev').setup()

-- The line beneath this is called `modeline`. See `:help modeline`
-- vim: ts=2 sts=2 sw=2 et
