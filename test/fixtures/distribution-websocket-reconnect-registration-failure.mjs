import { loadDistribution } from './load-distribution.mjs';
import { createMockWebSocketConstructor } from './websocket-test-utils.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWebSocket } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const createOwnedRoot = (factory) => {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
};

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const registrationError = new Error('timer registration failed');
const timers = new Map();
let nextTimer = 0;
let failRegistration = true;
globalThis.setTimeout = (callback) => {
  if (failRegistration) {
    failRegistration = false;
    throw registrationError;
  }
  const timer = ++nextTimer;
  timers.set(timer, callback);
  return timer;
};
globalThis.clearTimeout = (timer) => {
  timers.delete(timer);
};

try {
  let reportedError;
  const sockets = createMockWebSocketConstructor();
  const root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      autoReconnect: { retries: 1, delay: 0 },
      onError(error) {
        reportedError = error;
      }
    })
  );
  root.value.open();
  sockets.instances[0].serverClose();

  if (
    root.value.status() !== 'CLOSED' ||
    root.value.reconnectCount() !== 0 ||
    root.value.error() !== registrationError ||
    reportedError !== registrationError ||
    timers.size !== 0
  ) {
    throw new Error('built useWebSocket retained failed reconnect registration state');
  }

  if (!root.value.reconnect() || sockets.instances.length !== 2) {
    throw new Error('built useWebSocket could not recover after reconnect timer failure');
  }
  sockets.instances[1].serverClose();
  if (root.value.reconnectCount() !== 1 || timers.size !== 1) {
    throw new Error('built useWebSocket consumed retry budget on timer registration failure');
  }

  const [timer, callback] = [...timers.entries()][0];
  timers.delete(timer);
  callback();
  if (sockets.instances.length !== 3) {
    throw new Error('built useWebSocket did not reconnect after timer recovery');
  }
  root.dispose();
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
