import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const timers = new Map();
let nextTimer = 0;
let cancelDuringRegistration = false;
const stateRef = { current: undefined };
globalThis.setTimeout = (callback) => {
  const timer = ++nextTimer;
  timers.set(timer, callback);
  if (cancelDuringRegistration) {
    cancelDuringRegistration = false;
    stateRef.current.cancel();
  }
  return timer;
};
globalThis.clearTimeout = (timer) => {
  timers.delete(timer);
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
          return serviceCalls;
        },
        { manual: true, pollingInterval: 10 }
      )
    );
  } finally {
    __fictPopContext();
  }
  const state = root.value;
  stateRef.current = state;
  cancelDuringRegistration = true;

  await state.runAsync();
  for (const callback of [...timers.values()]) callback();
  await Promise.resolve();
  await Promise.resolve();

  if (serviceCalls !== 1 || timers.size !== 0 || state.loading()) {
    throw new Error('built useRequest retained polling after synchronous cancellation');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
