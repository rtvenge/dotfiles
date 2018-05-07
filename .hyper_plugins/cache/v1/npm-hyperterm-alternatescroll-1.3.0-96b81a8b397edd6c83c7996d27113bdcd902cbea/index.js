exports.reduceSessions = (state, action) => {
  switch (action.type) {
    case 'ALTERNATE_SCREEN_ON':
      return state.merge({
        sessions: {
          [action.uid]: {
            inAlternateScreen: true
          }
        }
      }, {
        deep: true
      });
    case 'ALTERNATE_SCREEN_OFF':
      return state.merge({
        sessions: {
          [action.uid]: {
            inAlternateScreen: false
          }
        }
      }, {
        deep: true
      });
  }
  return state;
};

function onAlternateScrollDown(lines) {
  return (dispatch, getState) => {
    dispatch({
      type: 'ALTERNATE_SCROLL_DOWN',
      lines: lines,
      effect() {
        const {
          sessions
        } = getState();
        const uid = sessions.activeUid;
        if (sessions.sessions[uid].inAlternateScreen) {
          window.rpc.emit('data', {
            uid: uid,
            data: '\u001bOB'.repeat(lines)
          });
        }
      }
    });
  };
}

function onAlternateScrollUp(lines) {
  return (dispatch, getState) => {
    dispatch({
      type: 'ALTERNATE_SCROLL_UP',
      lines: lines,
      effect() {
        const {
          sessions
        } = getState();
        const uid = sessions.activeUid;
        if (sessions.sessions[uid].inAlternateScreen) {
          window.rpc.emit('data', {
            uid: uid,
            data: '\u001bOA'.repeat(lines)
          });
        }
      }
    });
  };
}

exports.mapTermsDispatch = (dispatch, map) => {
  return Object.assign(map, {
    onAlternateScrollDown: (lines) => {
      dispatch(onAlternateScrollDown(lines));
    },
    onAlternateScrollUp: (lines) => {
      dispatch(onAlternateScrollUp(lines));
    },
  });
};

exports.getTermGroupProps = (uid, parentProps, props) => {
  return Object.assign(props, {
    onAlternateScrollDown: parentProps.onAlternateScrollDown,
    onAlternateScrollUp: parentProps.onAlternateScrollUp
  });
}

exports.getTermProps = (uid, parentProps, props) => {
  var inAlternateScreen = false;
  for (var key in parentProps.sessions) {
    var session = parentProps.sessions[key];
    if (uid == session.uid) {
      inAlternateScreen = session.inAlternateScreen;
    }
  }
  return Object.assign(props, {
    inAlternateScreen: inAlternateScreen,
    onAlternateScrollDown: parentProps.onAlternateScrollDown,
    onAlternateScrollUp: parentProps.onAlternateScrollUp
  });
}


var scrollingDelta;

function updateCurrentConfigScrollingDelta() {
  var userScrollSpeed = 50;
  try {
    userScrollSpeed = window.config.getConfig().alternateScroll.scrollSpeed;
    if (userScrollSpeed > 100 || userScrollSpeed < 1) {
      userScrollSpeed = Math.min(100, Math.max(1, userScrollSpeed));
      console.error("Plugin: hyperterm-alternatescroll", "scrollSpeed should be between 1 and 100");
    }
  } catch (e) {}
  scrollingDelta = 510 - (userScrollSpeed * 5);
}

exports.decorateTerm = (Term, {
  React
}) => {
  updateCurrentConfigScrollingDelta();

  return class extends React.Component {
    constructor() {
      super();
      this.currentDelta = 0;
    }

    onTerminal(term) {
      this.term = term;
      const originalOnTerminal = this.props.onTerminal;
      if (originalOnTerminal) originalOnTerminal(term);
    }

    onWheel(e) {
      if (this.props.inAlternateScreen) {
        this.currentDelta += e.wheelDeltaY;
        if (this.currentDelta < -scrollingDelta) {
          this.props.onAlternateScrollDown(Math.min(5, -this.currentDelta / scrollingDelta));
          this.currentDelta = -(-this.currentDelta % scrollingDelta);
        } else if (this.currentDelta > scrollingDelta) {
          this.props.onAlternateScrollUp(Math.min(5, this.currentDelta / scrollingDelta));
          this.currentDelta = this.currentDelta % scrollingDelta;
        }
        e.preventDefault();
      }
    }

    componentWillReceiveProps(newProps) {
      if (newProps.inAlternateScreen != this.props.inAlternateScreen) {
        // disable scrolling if in alternate screen
        this.term.prefs_.set('scroll-wheel-move-multiplier', newProps.inAlternateScreen ? 0 : 1);
      }
    }

    render() {
      const onTerminal = this.onTerminal.bind(this);
      const onWheel = this.onWheel.bind(this);

      const props = Object.assign({}, this.props, {
        onWheel,
        onTerminal
      });

      return React.createElement(Term, props);
    }
  };
};

exports.middleware = (store) => (next) => (action) => {
  if (!action) return;
  if (action.type == 'SESSION_PTY_DATA') {
    if (action.data.indexOf('\u001b[?1049h') !== -1) {
      store.dispatch({
        type: 'ALTERNATE_SCREEN_ON',
        uid: action.uid
      });
    } else if (action.data.indexOf('\u001b[?1049l') !== -1) {
      store.dispatch({
        type: 'ALTERNATE_SCREEN_OFF',
        uid: action.uid
      });
    }
  } else if (action.type == "CONFIG_RELOAD") {
    updateCurrentConfigScrollingDelta();
  }
  next(action);
};