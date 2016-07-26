module.exports = {
  config: {
    // default font size in pixels for all tabs
    fontSize: 18,

    // font family with optional fallbacks
    fontFamily: '"Source Code Pro for Powerline", "DejaVu Sans Mono", "Lucida Console", monospace',

    // terminal cursor background color (hex)
    cursorColor: '#ffc600',

    // color of the text
    foregroundColor: '#fff',

    // terminal background color
    backgroundColor: '#173448',

    // border color (window, tabs)
    borderColor: 'transparent',

    // custom css to embed in the main window
    css: '',

    // custom css to embed in the terminal window
    termCSS: '',

    // custom padding (css format, i.e.: `top right bottom left`)
    padding: '4px',

    // some color overrides. see http://bit.ly/29k1iU2 for
    // the full list
    colors: [
      '#173448',
      '#b9362a',
      '#46d56d',
      '#FF9D00',
      '#005cbb', // path bar
      '#a53dcf',
      '#34a283',
      '#bec3c6',

      '#374960',
      '#de483c',
      '#35a251',
      '#ffc600',
      '#4a92db',
      '#964ab6',
      '#3dbe99',
      '#ecf0f1'
    ]

  },

  // a list of plugins to fetch and install from npm
  // format: [@org/]project[#version]
  // examples:
  //   `hyperpower`
  //   `@company/project`
  //   `project#1.0.1`
  plugins: [
    // 'cobalt2-hyperterm-theme'
  ],

  // in development, you can create a directory under
  // `~/.hyperterm_plugins/local/` and include it here
  // to load it and avoid it being `npm install`ed
  localPlugins: []
};
