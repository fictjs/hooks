import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useIdle } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createHook(options) {
  __fictPushContext();
  try {
    return createRoot(() => useIdle(options));
  } finally {
    __fictPopContext();
  }
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let dispose = () => {};
let armed = false;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === false) {
      armed = false;
      dispose();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  const terminalRoot = createHook({
    window: new globalThis.EventTarget(),
    document: null,
    immediate: false,
    initialState: true
  });
  dispose = terminalRoot.dispose;
  armed = true;
  terminalRoot.value.resume();

  if (
    terminalRoot.value.active() ||
    terminalRoot.value.idle() ||
    terminalRoot.value.lastActive() !== null
  ) {
    throw new Error('built useIdle continued activity state after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}

const timerRoot = createHook({
  window: new globalThis.EventTarget(),
  document: null,
  immediate: false,
  initialState: false
});
let scheduled = () => {};
const previousSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback) => {
  scheduled = callback;
  timerRoot.value.pause();
  return 17;
};
try {
  timerRoot.value.resume();
} finally {
  globalThis.setTimeout = previousSetTimeout;
}
scheduled();

if (timerRoot.value.active() || timerRoot.value.idle()) {
  throw new Error('built useIdle retained a timer scheduled through pause');
}
timerRoot.dispose();
