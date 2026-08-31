-- Inline completion -- the ghost-text slot that opened up when ai.copilot was
-- removed (de7f0a9). Runs Qwen2.5-Coder 1.5B locally through LM Studio, so
-- there's no second subscription and no code leaves the machine.
--
-- This started on Zed's Zeta 2.1, which is the better model: it predicts the
-- *next edit* from recent edit history and rewrites whole regions rather than
-- completing at the cursor. It was dropped on latency, not quality. Measured on
-- this M1 Max, prefill is the entire cost and scales linearly with prompt size:
--
--     model                params   prefill      decode      typical request
--     Zeta 2.1 Q4_K_M        8.3B    356 tok/s    28 tok/s        ~4.3s
--     Qwen2.5-Coder Q8_0     1.5B   2017 tok/s    76 tok/s        ~1.1s
--
-- Nothing on the LM Studio side closed that gap: GPU offload was already 100%,
-- no downloaded model is a compatible draft for speculative decoding, and an
-- MLX 4-bit Zeta build measured *worse* (192-220 tok/s prefill). Zeta 2 has a
-- byte-identical architecture to 2.1, so it is no cheaper either. Model size
-- was the only lever that moved.
--
-- What the trade costs: FIM fills one region at the cursor, so the multi-region
-- rewrites and edit-history awareness are gone. cursortab still earns its place
-- over minuet/blink-edit for the jump indicator and multi-line overlay UI, and
-- going back is a provider block away -- zeta-2.1-i1 is still in LM Studio.
--
-- Requires:
--   * LM Studio serving QuantFactory/Qwen2.5-Coder-1.5B-GGUF @ Q8_0 on :1234.
--     Must be the *base* model, not -Instruct -- FIM tokens only exist on base.
--   * Go, to build the plugin's daemon (server/). Tracked in brew/leaves.txt.
-- With LM Studio down the daemon just times out and nothing renders, so a machine
-- without the model loaded degrades to plain Neovim rather than erroring.
--
-- On <Tab> sharing with blink.cmp: blink applies its keymaps buffer-locally while
-- cursortab maps globally, so LazyVim's snippet jump runs first and blink's
-- "fallback" then reaches cursortab. Snippets keep priority, cursortab gets the
-- key the rest of the time, and with no suggestion pending it inserts a real tab.
return {
  {
    "cursortab/cursortab.nvim",
    build = "cd server && go build",
    opts = {
      provider = {
        type = "fim",
        url = "http://localhost:1234",
        model = "qwen2.5-coder-1.5b",
        -- Input trimming budget. Prompt size maps almost linearly to latency,
        -- and this also has to stay under the context window LM Studio loaded
        -- the model with (8192) or the request comes back 400.
        context_size = 4096,
        -- FIM fills one region, so it never needs Zeta's 512. Lower is faster.
        max_tokens = 128,
        completion_timeout = 5000,
        -- No fim_tokens block here on purpose. The plugin documents one in
        -- config.lua's comments, but it is not a real key in default_config,
        -- and validate_config_keys() errors on anything absent from defaults --
        -- setting it fails the whole plugin at startup.
        -- Omitting it is the supported path anyway: cursortab then sends the
        -- OpenAI prompt+suffix form, and llama.cpp assembles the FIM prompt from
        -- the tokens baked into the GGUF, so Qwen's specials get used regardless.
      },
      keymaps = {
        -- Manual trigger, kept from debugging the Zeta setup. It skips every
        -- suppression gate (server/engine/request.go: `if manual { return "" }`),
        -- so it forces a prediction when the idle path stays quiet. blink owns
        -- <C-Space> in insert mode; this also binds normal mode, where blink
        -- isn't listening.
        trigger = "<C-Space>",
      },
      -- log_level = "debug", -- logs each state transition and provider call to
      -- ~/.local/state/nvim/cursortab/cursortab.log. Noisy: fires per keystroke.
    },
  },
}
