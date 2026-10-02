return {
	-- Catppuccin, matched to Ghostty / herdr / Zed: Mocha when dark, Latte when light.
	{
		"LazyVim/LazyVim",
		opts = {
			colorscheme = "catppuccin",
		},
	},
	{
		"catppuccin/nvim",
		-- "auto" picks from vim.o.background via the table below. That already
		-- resolved to mocha, but only by coincidence of the plugin's defaults --
		-- stated here so a future default change can't silently repaint the editor.
		opts = {
			flavour = "auto",
			background = { light = "latte", dark = "mocha" },
		},
	},
}
