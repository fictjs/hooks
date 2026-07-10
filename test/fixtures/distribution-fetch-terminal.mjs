import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useFetch } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const requestError = new Error('request failed');
let fetchCalls = 0;
let onErrorCalls = 0;
let dispose = () => {};
let armed = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === requestError) {
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
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useFetch('https://example.com', {
        fetch: async () => {
          fetchCalls += 1;
          throw requestError;
        },
        immediate: false,
        initialData: 'initial',
        onError() {
          onErrorCalls += 1;
        }
      })
    );
  } finally {
    __fictPopContext();
  }

  dispose = root.dispose;
  armed = true;
  const result = await root.value.execute();

  if (result !== 'initial' || root.value.error() !== requestError) {
    throw new Error('built useFetch did not retain terminal error state after disposal');
  }
  if (!root.value.aborted() || root.value.isLoading() || onErrorCalls !== 0) {
    throw new Error('built useFetch called onError or failed to settle after disposal');
  }

  const terminalResult = await root.value.execute();
  if (terminalResult !== 'initial' || fetchCalls !== 1) {
    throw new Error('built useFetch restarted after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
