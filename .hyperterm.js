module.exports = {
  config: {
    // default font size in pixels for all tabs
    fontSize: 18,

    // font family with optional fallbacks
    fontFamily: '"Source Code Pro for Powerline", "DejaVu Sans Mono", "Lucida Console", monospace',

    // terminal cursor background color (hex)
    cursorColor: '#ffc600',

    cursorShape: 'BEAM',
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
    termCSS: '',

    // custom padding (css format, i.e.: `top right bottom left`)
    padding: '4px',

    windowSize: [1024, 768],

    // some color overrides. see http://bit.ly/29k1iU2 for
    // the full list
    colors: {
      black: '#173448',
      red: '#de483c',
      green: '#46d56d',
      yellow: '#ffc600',
      blue: '#005cbb',
      magenta: '#a53dcf',
      cyan: '#34a283',
      white: '#bec3c6',
      lightBlack: '#374960',
      lightRed: '#de483c',
      lightGreen: '#35a251',
      lightYellow: '#ffc600',
      lightBlue: '#4a92db',
      lightMagenta: '#964ab6',
      lightCyan: '#3dbe99',
      lightWhite: '#ecf0f1'
    },

  },

  // a list of plugins to fetch and install from npm
  // format: [@org/]project[#version]
  plugins: [
    'hyperterm-1password',
    'hyperpower',
    'hyperterm-dibdabs'
  ],

  // in development, you can create a directory under
  // `~/.hyperterm_plugins/local/` and include it here
  // to load it and avoid it being `npm install`ed
  localPlugins: []
};
