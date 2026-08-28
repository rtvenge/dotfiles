-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
-- Add any additional autocmds here

local augroup = vim.api.nvim_create_augroup("ryan_config", { clear = true })

-- Zed: PHP is the one language with "format_on_save": "on".
-- vim.g.autoformat is false globally (options.lua), so opt PHP back in.
vim.api.nvim_create_autocmd("FileType", {
  group = augroup,
  pattern = "php",
  callback = function()
    vim.b.autoformat = true
  end,
})

-- Zed: "remove_trailing_whitespace_on_save": true.
-- Runs regardless of format-on-save, exactly like Zed's setting.
vim.api.nvim_create_autocmd("BufWritePre", {
  group = augroup,
  callback = function(event)
    if vim.bo[event.buf].binary or vim.bo[event.buf].filetype == "diff" then
      return
    end
    local view = vim.fn.winsaveview()
    vim.cmd([[keeppatterns %s/\s\+$//e]])
    vim.fn.winrestview(view)
  end,
})
