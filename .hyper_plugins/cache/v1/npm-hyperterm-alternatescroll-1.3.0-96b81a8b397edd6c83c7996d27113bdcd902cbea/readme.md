# hyperterm-alternatescroll for [hyperterm](https://hyperterm.org/)

[![npm version](https://img.shields.io/npm/v/hyperterm-alternatescroll.svg)](https://www.npmjs.com/package/hyperterm-alternatescroll)

Mousewheel/trackpad scrolling for alternate screen. (less, git log, nano, etc...)

## Requirement

Hyperterm **0.7.2** or the latest master branch.


# Demo

#### Without hyperterm-alternatescroll

![Without hyperterm-alternatescroll](media/without.gif)

#### With hyperterm-alternatescroll

![With hyperterm-alternatescroll](media/with.gif)

# Installation

add `hyperterm-alternatescroll` to `~/.hyperterm.js`'s plugin list.

```javascript
{
	//...
	plugins:["hyperterm-alternatescroll"],
}
```

# Config

You can tweak the scroll speed in `~/.hyperterm.js`.
```javascript
module.exports = {
  config: {
    // for hyperterm-alternatescroll plugin
    alternateScroll: {
      // 1 to 100 is supported
      scrollSpeed: 80
    }
  }
}
```

# License

The MIT License (MIT)

Copyright (c) 2016 lkzhao
