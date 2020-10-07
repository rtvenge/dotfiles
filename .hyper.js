module.exports = {
  config: {
    shell: "/usr/local/bin/fish",

    // Appearance
    fontFamily:
      '"Perplexed", "Source Code Pro for Powerline", "DejaVu Sans Mono", "Lucida Console", monospace',
    cursorColor: "#f4d300",
    backgroundColor: "#173448",
    borderColor: "#ffc600",
    wickedBorderColor: "#173448",
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
    "hyperterm-dibdabs",
    "hyperterm-bold-tab",
    "hyperterm-title",
    "hyper-search",
    // Dark Theme
    'hyperterm-cobalt2-theme',
    // Light Theme
    // "hyper-hypest",
  ],
};
