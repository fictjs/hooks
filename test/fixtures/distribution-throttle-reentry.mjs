import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useThrottleFn } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let nextId = 0;
const scheduled = new Map();
let controls;
let cancelOnPending = false;

globalThis.setTimeout = (callback) => {
  const id = ++nextId;
  scheduled.set(id, callback);
  return id;
};
globalThis.clearTimeout = (id) => scheduled.delete(id);
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
      useThrottleFn(() => {}, 100, { leading: false, trailing: true })
    );
  } finally {
    __fictPopContext();
  }

  controls = root.value;
  cancelOnPending = true;
  controls.run();
  if (controls.pending() || scheduled.size !== 0) {
    throw new Error('built throttle ignored cancellation from pending notification');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
