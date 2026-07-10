import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useTimeoutFn } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let nextId = 0;
const scheduled = new Map();
let controls;
let reenterOnClear = false;
let reenterOnDelay = false;
let cancelOnPending = false;

globalThis.setTimeout = (callback) => {
  const id = ++nextId;
  scheduled.set(id, callback);
  return id;
};
globalThis.clearTimeout = (id) => {
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
    root = createRoot(() =>
      useTimeoutFn(() => {}, () => {
        if (reenterOnDelay) {
          reenterOnDelay = false;
          controls.run();
        }
        return 100;
      })
    );
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  reenterOnClear = true;
  controls.run();
  if (scheduled.size !== 1) {
    throw new Error('built timeout retained an unowned timer after clearTimeout reentry');
  }
  controls.cancel();
  if (scheduled.size !== 0) {
    throw new Error('built timeout could not cancel the reentrant timer');
  }

  controls.run();
  reenterOnDelay = true;
  controls.run();
  if (scheduled.size !== 1) {
    throw new Error('built timeout retained an unowned timer after delay reentry');
  }
  controls.cancel();

  cancelOnPending = true;
  controls.run();
  if (controls.pending() || scheduled.size !== 0) {
    throw new Error('built timeout ignored cancellation from pending notification');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
