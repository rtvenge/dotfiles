module.exports = {
  config: {
    catppuccinTheme: 'mocha',
    shell: "/bin/zsh",

    // Appearance
    fontFamily:
      '"BlexMono Nerd Font", "Perplexed", "Source Code Pro for Powerline", "DejaVu Sans Mono", "Lucida Console", monospace',
    fontSize: 14,
    cursorShape: "BEAM",

    // Style
    css: "",
    padding: "4px",
    windowSize: [1024, 768],

    // Behavior
    scrollback: 10000,
    copyOnSelect: true,
  },

  plugins: [
    "hyperterm-1password",
    "hyper-search",
    "hyperline",
    // Dark Theme
    "hyperterm-cobalt2-theme",
    'hypurr#latest',
    "hyper-quit",
    // Light Theme
    // "hyper-hypest",
    "hyper-hide-title"
  ],
};
