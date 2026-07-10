import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useIdle } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let failRegistration = true;
let scheduled = () => {};
globalThis.setTimeout = (callback) => {
  if (failRegistration) {
    failRegistration = false;
    throw new Error('timer registration failed');
  }
  scheduled = callback;
  return 1;
};
globalThis.clearTimeout = () => {};

try {
  const windowRef = new globalThis.EventTarget();
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useIdle({ window: windowRef, document: null, immediate: false, timeout: 1000 })
    );
  } finally {
    __fictPopContext();
  }

  let registrationError;
  try {
    root.value.resume();
  } catch (error) {
    registrationError = error;
  }
  if (!(registrationError instanceof Error) || root.value.active()) {
    throw new Error('built useIdle did not roll back a failed timer registration');
  }

  root.value.resume();
  scheduled();
  if (!root.value.active() || !root.value.idle()) {
    throw new Error('built useIdle could not recover after timer registration failed');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
