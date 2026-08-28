-- Claude Code in a Neovim split, over the same WebSocket/MCP protocol the VS Code
-- extension uses. Runs against the Claude Code CLI and your existing subscription,
-- so there's no API key involved.
--
-- Keys live under LazyVim's existing <leader>a "+ai" group, which the copilot-chat
-- extra already owns <leader>aa/ax/aq/ap in -- diff accept is moved to <leader>ay
-- so it doesn't shadow CopilotChat's toggle.
return {
  {
    "coder/claudecode.nvim",
    dependencies = { "folke/snacks.nvim" },
    config = true,
    cmd = {
      "ClaudeCode",
      "ClaudeCodeFocus",
      "ClaudeCodeSelectModel",
      "ClaudeCodeAdd",
      "ClaudeCodeSend",
      "ClaudeCodeTreeAdd",
      "ClaudeCodeStatus",
      "ClaudeCodeStart",
      "ClaudeCodeStop",
      "ClaudeCodeOpen",
      "ClaudeCodeClose",
      "ClaudeCodeDiffAccept",
      "ClaudeCodeDiffDeny",
      "ClaudeCodeCloseAllDiffs",
    },
    keys = {
      { "<leader>ac", "<cmd>ClaudeCode<cr>", desc = "Toggle Claude" },
      { "<leader>af", "<cmd>ClaudeCodeFocus<cr>", desc = "Focus Claude" },
      { "<leader>ar", "<cmd>ClaudeCode --resume<cr>", desc = "Resume Claude" },
      { "<leader>aC", "<cmd>ClaudeCode --continue<cr>", desc = "Continue Claude" },
      { "<leader>am", "<cmd>ClaudeCodeSelectModel<cr>", desc = "Select Claude Model" },
      { "<leader>ab", "<cmd>ClaudeCodeAdd %<cr>", desc = "Add Current Buffer to Claude" },
      { "<leader>as", "<cmd>ClaudeCodeSend<cr>", mode = "v", desc = "Send Selection to Claude" },
      {
        "<leader>as",
        "<cmd>ClaudeCodeTreeAdd<cr>",
        desc = "Add File to Claude",
        ft = { "neo-tree", "NvimTree", "oil", "minifiles", "netrw", "snacks_picker_list" },
      },
      { "<leader>ay", "<cmd>ClaudeCodeDiffAccept<cr>", desc = "Accept Claude Diff" },
      { "<leader>ad", "<cmd>ClaudeCodeDiffDeny<cr>", desc = "Deny Claude Diff" },
    },
  },
}
