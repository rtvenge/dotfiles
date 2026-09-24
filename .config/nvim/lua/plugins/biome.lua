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
      servers = {
        biome = {
          -- Run the project's own biome when it ships one, the way Zed's
          -- "binary": { "path": "./node_modules/.bin/biome" } does. Mason's copy
          -- is only the fallback: it drifts from whatever a repo pins, and then
          -- the editor disagrees with the repo's npm test and CI.
          cmd = function(dispatchers, config)
            local exe = "biome"

            if config.root_dir then
              local project_bin = vim.fs.joinpath(config.root_dir, "node_modules", ".bin", "biome")

              if vim.uv.fs_stat(project_bin) then
                exe = project_bin
              end
            end

            return vim.lsp.rpc.start({ exe, "lsp-proxy" }, dispatchers)
          end,
        },
      },
    },
  },

  {
    "stevearc/conform.nvim",
    opts = {
      formatters = {
        -- conform's biome formatter already resolves node_modules/.bin/biome, so
        -- this only keeps it from running biome in projects with no biome config.
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
