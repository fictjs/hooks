import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let markRetryTimerRegistered = () => {};
const retryTimerRegistered = new Promise((resolve) => {
  markRetryTimerRegistered = resolve;
});
let nested;
let reenterOnClear = false;
const stateRef = { current: undefined };
globalThis.setTimeout = () => {
  markRetryTimerRegistered();
  return 1;
};
globalThis.clearTimeout = () => {
  if (reenterOnClear) {
    reenterOnClear = false;
    nested = stateRef.current.runAsync('inner');
  }
};

try {
  const calls = [];
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useRequest(
        async (value) => {
          calls.push(value);
          if (value === 'retry') throw new Error('retry');
          return value;
        },
        { manual: true, retryCount: 1, retryInterval: 10 }
      )
    );
  } finally {
    __fictPopContext();
  }
  stateRef.current = root.value;
  const retrying = root.value.runAsync('retry');
  await retryTimerRegistered;
  reenterOnClear = true;

  await root.value.runAsync('outer');
  await nested;
  await retrying;

  if (
    calls.length !== 2 ||
    calls[0] !== 'retry' ||
    calls[1] !== 'inner' ||
    root.value.data() !== 'inner' ||
    root.value.params()?.[0] !== 'inner'
  ) {
    throw new Error('built useRequest overwrote a run started by retry cleanup');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
