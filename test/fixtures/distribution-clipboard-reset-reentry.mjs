import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClipboard } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const timers = new Map();
let nextId = 0;
const windowRef = {
  setTimeout(callback) {
    const id = ++nextId;
    timers.set(id, callback);
    return id;
  },
  clearTimeout(id) {
    timers.delete(id);
  }
};
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let copyNested = () => Promise.resolve(false);
let nestedCopy;
let resetReentry = false;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (resetReentry && value === false) {
      resetReentry = false;
      nestedCopy = copyNested();
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
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        window: windowRef,
        document: null
      })
    );
  } finally {
    __fictPopContext();
  }
  copyNested = () => root.value.copy('nested-reset');
  await root.value.copy('first');

  const [firstTimerId, firstTimer] = [...timers.entries()][0];
  timers.delete(firstTimerId);
  resetReentry = true;
  firstTimer();
  const nestedResult = await nestedCopy;

  if (!nestedResult || timers.size !== 1 || !root.value.copied()) {
    throw new Error('built clipboard lost a reentrant reset timer');
  }
  root.dispose();
  if (timers.size !== 0) {
    throw new Error('built clipboard could not dispose the reentrant reset timer');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
