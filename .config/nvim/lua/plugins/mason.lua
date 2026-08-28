return {
  -- CLI tools only. Language servers are installed automatically from the
  -- `servers` table in the lspconfig specs, so they don't belong here.
  {
    "mason-org/mason.nvim",
    opts = {
      ensure_installed = {
        "shellcheck",
        "shfmt",
        "stylua",
      },
    },
  },
}
