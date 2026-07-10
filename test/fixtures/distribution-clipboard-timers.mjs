import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClipboard } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

function createTimerWindow() {
  const active = new Set();
  let nextId = 0;
  let onSet;
  let onClear;
  return {
    active,
    set onSet(callback) {
      onSet = callback;
    },
    set onClear(callback) {
      onClear = callback;
    },
    setTimeout() {
      const id = ++nextId;
      active.add(id);
      onSet?.();
      return id;
    },
    clearTimeout(id) {
      active.delete(id);
      onClear?.();
    }
  };
}

const backend = { clipboard: { writeText: async () => {} } };

const setWindow = createTimerWindow();
let setDispose = () => {};
const setRoot = createCompiledRoot(() =>
  useClipboard({ navigator: backend, window: setWindow, document: null })
);
setDispose = setRoot.dispose;
setWindow.onSet = () => {
  setWindow.onSet = undefined;
  setDispose();
};
await setRoot.value.copy('set-dispose');
if (setWindow.active.size !== 0) {
  throw new Error('built clipboard retained a timer registered during disposal');
}

const clearWindow = createTimerWindow();
let clearDispose = () => {};
const clearRoot = createCompiledRoot(() =>
  useClipboard({ navigator: backend, window: clearWindow, document: null })
);
clearDispose = clearRoot.dispose;
await clearRoot.value.copy('first');
clearWindow.onClear = () => {
  clearWindow.onClear = undefined;
  clearDispose();
};
await clearRoot.value.copy('second');
if (clearWindow.active.size !== 0) {
  throw new Error('built clipboard registered a timer after clear-time disposal');
}
