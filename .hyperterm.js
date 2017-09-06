module.exports = {
  config: {
    // default font size in pixels for all tabs
    fontSize: 18,

    // font family with optional fallbacks
    fontFamily: '"Source Code Pro for Powerline", "DejaVu Sans Mono", "Lucida Console", monospace',

    // terminal cursor background color (hex)
    cursorColor: '#f4d300',

    cursorShape: 'BEAM',
    // shell: '/usr/local/bin/fish',
    shell: 'zsh',

    // color of the text
    foregroundColor: '#fff',

    // terminal background color
    backgroundColor: '#173448',

    // border color (window, tabs)
    borderColor: '#35434d',

    // custom css to embed in the main window
    css: '',

    // custom css to embed in the terminal window
    termCSS: `
    x-row span[style="background-color: rgb(255, 255, 255);"] {
      background-color: rgba(199, 199, 199, 0.2) !important;
      border-radius: 2px;
      color: #33ff00;
    }
    `,

    // custom padding (css format, i.e.: `top right bottom left`)
    padding: '4px',

    windowSize: [1024, 768],
    // AKA Cobalt2
    colors: {
      black: '#173448',
      red: '#ff2600',
      green: '#3ddf2b ',
      yellow: '#ffe700',
      blue: '#1478db',
      magenta: '#ff2c70',
      cyan: '#00c5c7',
      white: '#c7c7c7',
      lightBlack: '#9d9d9d',
      lightRed: '#f92a1c',
      lightGreen: '#43d426',
      lightYellow: '#f1d000',
      lightBlue: '#6871ff',
      lightMagenta: '#ff77ff',
      lightCyan: '#79e8fb',
      lightWhite: '#ffffff'
    },

    plugins: {
      "hyperpower-plus": {
        "shake.enabled": false
      }
    }

  },

  // a list of plugins to fetch and install from npm
  // format: [@org/]project[#version]
  plugins: [
    'hyperterm-1password',
    // 'hyperpower-plus',
    'hyperterm-dibdabs',
    'hyperterm-bold-tab',
    'hyperterm-title',
    // 'hyperterm-paste'
    'hyperterm-alternatescroll',

  ],

  // in development, you can create a directory under
  // `~/.hyperterm_plugins/local/` and include it here
  // to load it and avoid it being `npm install`ed
  localPlugins: []
};
