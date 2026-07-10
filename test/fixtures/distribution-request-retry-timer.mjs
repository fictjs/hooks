import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const clearedTimers = [];
globalThis.setTimeout = (callback) => {
  callback();
  return 1;
};
globalThis.clearTimeout = (timer) => {
  clearedTimers.push(timer);
};

try {
  let serviceCalls = 0;
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useRequest(
        async () => {
          serviceCalls += 1;
          if (serviceCalls === 1) {
            throw new Error('retry');
          }
          return 2;
        },
        {
          manual: true,
          retryCount: 1,
          retryInterval: 1
        }
      )
    );
  } finally {
    __fictPopContext();
  }

  const result = await root.value.runAsync();
  if (result !== 2 || serviceCalls !== 2 || !clearedTimers.includes(1)) {
    throw new Error('built useRequest lost a synchronously fired retry timer');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
