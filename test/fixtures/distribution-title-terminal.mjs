import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useTitle } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const documentRef = { title: 'original' };
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let dispose = () => {};
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (value === 'next') dispose();
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
    root = createRoot(() => useTitle('initial', { document: documentRef, restoreOnUnmount: true }));
  } finally {
    __fictPopContext();
  }
  dispose = root.dispose;

  root.value.title('next');

  if (root.value.title() !== 'next' || documentRef.title !== 'original') {
    throw new Error('built useTitle overwrote its restored terminal title');
  }
  root.value.title('ignored');
  if (documentRef.title !== 'original') {
    throw new Error('built useTitle accepted a write after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
