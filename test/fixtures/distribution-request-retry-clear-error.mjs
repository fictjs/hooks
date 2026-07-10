import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let retryTimer = () => {};
let timerRegistered = false;
globalThis.setTimeout = (callback) => {
  retryTimer = callback;
  timerRegistered = true;
  return 1;
};
globalThis.clearTimeout = () => {
  throw new Error('timer cleanup failed');
};

try {
  let calls = 0;
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useRequest(
        async () => {
          calls += 1;
          if (calls === 1) throw new Error('retry');
          return 'ok';
        },
        { manual: true, retryCount: 1, retryInterval: 10 }
      )
    );
  } finally {
    __fictPopContext();
  }
  const pending = root.value.runAsync();
  while (!timerRegistered) {
    await Promise.resolve();
  }

  retryTimer();

  const result = await pending;
  if (result !== 'ok' || calls !== 2 || root.value.loading()) {
    throw new Error('built useRequest did not settle after retry timer cleanup failed');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
