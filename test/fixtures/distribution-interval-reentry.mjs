import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useIntervalFn } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let nextId = 0;
const scheduled = new Map();
let controls;
let reenterOnClear = false;
let cancelOnPending = false;

globalThis.setInterval = (callback) => {
  const id = ++nextId;
  scheduled.set(id, callback);
  return id;
};
globalThis.clearInterval = (id) => {
  scheduled.delete(id);
  if (reenterOnClear) {
    reenterOnClear = false;
    controls.run();
  }
};
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (cancelOnPending && value === true) {
      cancelOnPending = false;
      controls.cancel();
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
    root = createRoot(() => useIntervalFn(() => {}, 100));
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  reenterOnClear = true;
  controls.run();
  if (scheduled.size !== 1) {
    throw new Error('built interval retained an unowned handle after clearInterval reentry');
  }
  controls.cancel();
  if (scheduled.size !== 0) {
    throw new Error('built interval could not cancel the reentrant handle');
  }

  cancelOnPending = true;
  controls.run();
  if (controls.pending() || scheduled.size !== 0) {
    throw new Error('built interval ignored cancellation from pending notification');
  }
  root.dispose();
} finally {
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
