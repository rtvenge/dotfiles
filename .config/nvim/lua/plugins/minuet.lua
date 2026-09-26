-- Inline completion via Claude Haiku 4.5, over the Anthropic API.
--
-- Replaces cursortab.nvim + a local Qwen2.5-Coder 1.5B (removed in this commit).
-- That setup kept everything on-device, but a 1.5B FIM model is the weakest
-- link in the chain and it showed. This trades the local-only property -- buffer
-- context now goes to Anthropic on every prediction -- for a model that is
-- actually worth accepting.
--
-- Requires ANTHROPIC_API_KEY in the environment. It belongs in zsh/.private,
-- which .gitignore already excludes; never in a tracked file. Create the key at
-- console.anthropic.com under the default workspace.
--
-- Cost, because this one bills per keystroke-ish: Haiku 4.5 is $1/MTok in,
-- $5/MTok out. context_window below is 16000 *characters* (~4000 tokens), so a
-- request runs ~$0.004. The throttle/debounce/n_completions values are the main
-- levers -- see the notes on each. Expect roughly $10-30/month at steady use.
return {
  {
    "milanglacier/minuet-ai.nvim",
    -- No plenary: minuet uses vim.system now. `main` is set because lazy would
    -- otherwise infer the module name from the repo as "minuet-ai", not "minuet".
    main = "minuet",
    -- Must load *before* FileType fires. auto_trigger_ft is implemented as a
    -- FileType autocmd registered inside minuet.setup(), so loading any later
    -- (InsertEnter, VeryLazy) misses the event for buffers already open and the
    -- per-buffer trigger flag never gets set -- virtual text then silently
    -- never fires. BufReadPre/BufNewFile both precede filetype detection.
    event = { "BufReadPre", "BufNewFile" },
    opts = {
      provider = "claude",

      -- Virtual text is the frontend, so the completion-menu integrations stay
      -- off. They are alternatives, not layers: leaving either enabled fires a
      -- second, separately billed request on the same keystrokes.
      cmp = { enable_auto_complete = false },
      blink = { enable_auto_complete = false },

      -- Default is 3, which means 3x the requests and 3x the bill to populate
      -- the next/prev cycle. Virtual text shows one at a time anyway.
      n_completions = 1,

      -- Characters, not tokens (~16000 chars = ~4000 tokens), split around the
      -- cursor by context_ratio. This is the single biggest cost knob: halving
      -- it halves the input charge per request.
      context_window = 16000,

      -- Defaults are 400/1000. Raised because every trigger is a paid request,
      -- and because the local setup's hair-trigger predictions were the thing
      -- that made it feel like it was typing over you.
      debounce = 600,
      throttle = 1500,

      -- Seconds. Default 3 is tight once the network is in the path.
      request_timeout = 5,
      notify = "warn",

      virtualtext = {
        -- Wider than the list this came from, which omitted css/scss and lua --
        -- i.e. WordPress theme work and editing this config. Add filetypes here
        -- rather than globally; each one is more billable surface.
        auto_trigger_ft = {
          "php",
          "blade",
          "javascript",
          "javascriptreact",
          "typescript",
          "typescriptreact",
          "css",
          "scss",
          "html",
          "lua",
        },
        keymap = {
          accept = "<A-l>", -- whole suggestion
          accept_line = "<A-a>", -- one line of it
          next = "<A-]>", -- cycle / trigger manually
          prev = "<A-[>",
          dismiss = "<A-e>",
        },
      },

      provider_options = {
        claude = {
          -- The name of the env var, not the key.
          api_key = "ANTHROPIC_API_KEY",
          -- Canonical id, no date suffix. minuet's own default is the malformed
          -- "claude-haiku-4.5" (dots), which is not a valid model string.
          model = "claude-haiku-4-5",
          max_tokens = 256,
          stream = true,
        },
      },
    },
  },
}
