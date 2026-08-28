return {
  -- LazyVim declares `opts_extend = { "ensure_installed" }` on this spec, so these
  -- are added to LazyVim's defaults rather than replacing them.
  {
    "nvim-treesitter/nvim-treesitter",
    opts = {
      ensure_installed = {
        -- parity with the Zed language extensions
        "blade",
        "css",
        "php",
        "php_only",
        "scss",
        "sql",
        "toml",
        "twig",
        "xml",
      },
    },
  },
}
