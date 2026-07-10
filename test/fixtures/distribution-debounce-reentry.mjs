import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useDebounceFn } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let nextId = 0;
const scheduled = new Map();
let clearControls;
let reenterOnClear = false;
let cancelControls;
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
    clearControls.run('inner');
  }
};
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (cancelOnPending && value === true) {
      cancelOnPending = false;
      cancelControls.cancel();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

try {
  const calls = [];
  const clearRoot = createCompiledRoot(() => useDebounceFn((value) => calls.push(value), 100));
  clearControls = clearRoot.value;
  clearControls.run('first');
  reenterOnClear = true;
  clearControls.run('outer');

  if (scheduled.size !== 1) {
    throw new Error('built debounce retained an unowned timer after clearTimeout reentry');
  }
  for (const callback of [...scheduled.values()]) callback();
  if (calls.length !== 1 || calls[0] !== 'inner') {
    throw new Error('built debounce did not preserve the reentrant run');
  }
  clearRoot.dispose();
  scheduled.clear();

  const cancelRoot = createCompiledRoot(() => useDebounceFn(() => {}, 100));
  cancelControls = cancelRoot.value;
  cancelOnPending = true;
  cancelControls.run();
  if (cancelControls.pending() || scheduled.size !== 0) {
    throw new Error('built debounce ignored cancellation from pending notification');
  }
  cancelRoot.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
