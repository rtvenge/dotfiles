require("nvim-tree").setup({
  tab = {
    sync = {
      open = true,
      close = true,
    }
  },
  sort = {
    sorter = "case_sensitive",
  },
  view = {
    width = 30,
  },
  renderer = {
    group_empty = true,
  },
  filters = {
    dotfiles = true,
  },
})