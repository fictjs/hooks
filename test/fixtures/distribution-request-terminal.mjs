import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const cacheProvider = new Map();
let serviceCalls = 0;
let onSuccessCalls = 0;
let dispose = () => {};
let armed = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === 42) {
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
      useRequest(
        async () => {
          serviceCalls += 1;
          return 42;
        },
        {
          manual: true,
          cacheKey: 'distribution-disposed-success',
          cacheProvider,
          onSuccess() {
            onSuccessCalls += 1;
          }
        }
      )
    );
  } finally {
    __fictPopContext();
  }

  dispose = root.dispose;
  armed = true;
  const result = await root.value.runAsync();

  if (result !== 42 || root.value.data() !== 42 || root.value.loading()) {
    throw new Error('built useRequest did not settle after data-triggered disposal');
  }
  if (cacheProvider.has('distribution-disposed-success') || onSuccessCalls !== 0) {
    throw new Error('built useRequest committed terminal success work after disposal');
  }

  const terminalResult = await root.value.runAsync();
  if (terminalResult !== 42 || serviceCalls !== 1) {
    throw new Error('built useRequest restarted after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
