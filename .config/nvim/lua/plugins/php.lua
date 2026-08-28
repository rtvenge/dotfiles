-- PHP parity with the Zed setup:
--   "PHP": { "language_servers": ["phpcs", "!phpactor", "emmet-language-server"] }
--   "lsp": { "phpcs": { phpcs_path, phpcbf_path } }
--   tasks.json: "PHPCBF: Fix current file"
--
-- The Drupal/WordPress sniffs are registered against the *composer* install of
-- php_codesniffer, so both tools are resolved to a project `vendor/bin` first and
-- ~/.composer/vendor/bin second -- never to a mason-installed copy, which would
-- shadow them on PATH without knowing any of the standards.
local function composer_bin(name)
  return function()
    local root = vim.fs.root(0, { "composer.json", ".git" })
    local project = root and (root .. "/vendor/bin/" .. name)
    if project and vim.uv.fs_stat(project) then
      return project
    end
    return vim.fn.expand("~/.composer/vendor/bin/" .. name)
  end
end

return {
  -- Don't let mason install its own phpcs/php-cs-fixer (added by the lang.php extra).
  {
    "mason-org/mason.nvim",
    opts = function(_, opts)
      opts.ensure_installed = vim.tbl_filter(function(tool)
        return tool ~= "phpcs" and tool ~= "php-cs-fixer"
      end, opts.ensure_installed or {})
    end,
  },

  -- Zed runs emmet-language-server on PHP; do the same, plus the template filetypes.
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        emmet_language_server = {
          filetypes = {
            "blade",
            "css",
            "html",
            "htmldjango",
            "javascriptreact",
            "php",
            "scss",
            "twig",
            "typescriptreact",
          },
        },
      },
    },
  },

  -- phpcs diagnostics -- the Zed phpcs extension's read side.
  {
    "mfussenegger/nvim-lint",
    opts = {
      linters_by_ft = { php = { "phpcs" } },
      linters = {
        phpcs = {
          cmd = composer_bin("phpcs"),
          -- --stdin-path lets phpcs resolve the project's phpcs.xml from the real
          -- file location instead of Neovim's cwd.
          args = {
            "-q",
            "--report=json",
            function()
              return "--stdin-path=" .. vim.api.nvim_buf_get_name(0)
            end,
            "-",
          },
          -- nvim-lint's built-in parser reads report.files.STDIN, but --stdin-path
          -- makes phpcs key the report by the resolved file path instead.
          parser = function(output)
            if output == nil or vim.trim(output) == "" or not vim.startswith(output, "{") then
              return {}
            end
            local ok, decoded = pcall(vim.json.decode, output)
            if not ok or type(decoded) ~= "table" or type(decoded.files) ~= "table" then
              return {}
            end

            local severities = {
              ERROR = vim.diagnostic.severity.ERROR,
              WARNING = vim.diagnostic.severity.WARN,
            }
            local diagnostics = {}
            -- one entry, keyed by whatever path phpcs resolved
            for _, file in pairs(decoded.files) do
              for _, msg in ipairs(file.messages or {}) do
                table.insert(diagnostics, {
                  lnum = msg.line - 1,
                  end_lnum = msg.line - 1,
                  col = msg.column - 1,
                  end_col = msg.column - 1,
                  message = msg.message,
                  code = msg.source,
                  source = "phpcs",
                  severity = severities[msg.type] or vim.diagnostic.severity.WARN,
                })
              end
            end
            return diagnostics
          end,
        },
      },
    },
  },

  -- phpcbf formatting -- the Zed "PHPCBF: Fix current file" task, on save.
  -- Replaces php_cs_fixer, which the lang.php extra sets by default.
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = { php = { "phpcbf" } },
      formatters = { phpcbf = { command = composer_bin("phpcbf") } },
    },
  },
}
