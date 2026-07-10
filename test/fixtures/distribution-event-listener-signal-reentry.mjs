import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useEventListener } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class TrackingTarget extends globalThis.EventTarget {
  activeListeners = new Set();

  addEventListener(type, listener, options) {
    this.activeListeners.add(listener);
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    this.activeListeners.delete(listener);
    super.removeEventListener(type, listener, options);
  }
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
const target = new TrackingTarget();
let controls;
let restart = false;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (restart && value === false) {
      restart = false;
      controls.start();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  __fictPushContext();
  let root;
  try {
    root = createRoot(() => useEventListener(target, 'signal-restart', () => {}));
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  restart = true;
  controls.stop();
  if (!controls.active() || target.activeListeners.size !== 1) {
    throw new Error('built useEventListener lost a signal-notification restart');
  }

  controls.stop();
  if (target.activeListeners.size !== 0) {
    throw new Error('built useEventListener lost cleanup ownership after signal restart');
  }
  root.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
