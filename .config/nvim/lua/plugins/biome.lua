-- Biome parity with Zed's "lsp": { "biome": { "require_config_file": true } }.
--
-- nvim-lspconfig's biome config already ships `workspace_required = true` and a
-- root_dir that only resolves when biome.json/biome.jsonc (or a package.json with
-- a "biome" key) is present, so it attaches on exactly the same projects Zed does.
return {
  { "mason-org/mason.nvim", opts = { ensure_installed = { "biome" } } },

  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = { biome = {} },
    },
  },

  {
    "stevearc/conform.nvim",
    opts = {
      formatters = {
        -- Only format when the project actually has a biome config, matching
        -- require_config_file. Without this conform would run biome anywhere.
        biome = { require_cwd = true },
      },
      formatters_by_ft = {
        css = { "biome" },
        graphql = { "biome" },
        javascript = { "biome" },
        javascriptreact = { "biome" },
        json = { "biome" },
        jsonc = { "biome" },
        typescript = { "biome" },
        typescriptreact = { "biome" },
      },
    },
  },
}
