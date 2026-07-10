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

for (const operation of ['close', 'dispose']) {
  const scheduled = [];
  let root;
  try {
    globalThis.setTimeout = (callback) => {
      scheduled.push(callback);
      return scheduled.length;
    };
    globalThis.clearTimeout = () => {};
    const sockets = createMockWebSocketConstructor();
    let runOperation = () => {};
    root = createOwnedRoot(() =>
      useWebSocket('ws://fixture.test', {
        webSocket: sockets.Constructor,
        immediate: false,
        autoReconnect: {
          retries: 1,
          delay() {
            runOperation();
            return 0;
          }
        }
      })
    );
    runOperation = operation === 'close' ? root.value.close : root.dispose;
    root.value.open();
    sockets.instances[0].serverClose();

    if (scheduled.length !== 0 || root.value.reconnectCount() !== 0) {
      throw new Error(`built useWebSocket scheduled reconnect after delay ${operation}`);
    }
    if (sockets.instances.length !== 1 || root.value.status() !== 'CLOSED') {
      throw new Error(`built useWebSocket reopened after delay ${operation}`);
    }
    root.dispose();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

{
  let root;
  try {
    globalThis.setTimeout = (callback) => {
      callback();
      return 42;
    };
    globalThis.clearTimeout = () => {};
    const sockets = createMockWebSocketConstructor();
    root = createOwnedRoot(() =>
      useWebSocket('ws://fixture.test', {
        webSocket: sockets.Constructor,
        immediate: false,
        autoReconnect: { retries: 2, delay: 0 }
      })
    );
    root.value.open();
    sockets.instances[0].serverClose();
    sockets.instances[1].serverClose();

    if (sockets.instances.length !== 3) {
      throw new Error('built useWebSocket retained a synchronously fired timer handle');
    }
    root.dispose();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}
