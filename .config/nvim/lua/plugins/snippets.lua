-- Zed's snippets, shared rather than copied: .config/zed/snippets is VS Code
-- format, which blink.cmp reads natively (one <filetype>.json per language).
-- blink parses them as strict JSON, so keep comments and trailing commas out of
-- those files even though Zed would tolerate them.
return {
  {
    "saghen/blink.cmp",
    opts = {
      sources = {
        providers = {
          snippets = {
            opts = {
              search_paths = {
                vim.fn.stdpath("config") .. "/snippets", -- blink's default
                vim.fn.expand("~/.config/zed/snippets"),
              },
              -- The acf:*, module:* and echo snippets live in html.json because
              -- Zed offered them inside PHP templates; Neovim sees those files as
              -- plain php, so pull the html snippets in there too.
              extended_filetypes = { php = { "html" } },
            },
          },
        },
      },
    },
  },
}
