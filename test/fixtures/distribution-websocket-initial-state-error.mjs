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

for (const property of ['readyState', 'CONNECTING', 'OPEN']) {
  const initialStateError = new Error(`${property} failed`);
  const sockets = createMockWebSocketConstructor();
  let constructions = 0;
  let onErrorValue;
  const ThrowingStateConstructor = function ThrowingStateConstructor(url, protocols) {
    constructions += 1;
    const currentSocket = new sockets.Constructor(url, protocols);
    if (constructions === 1) {
      if (property === 'OPEN') {
        currentSocket.readyState = currentSocket.OPEN;
      }
      Object.defineProperty(currentSocket, property, {
        configurable: true,
        get() {
          throw initialStateError;
        }
      });
    }
    return currentSocket;
  };
  const root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: ThrowingStateConstructor,
      immediate: false,
      onError(error) {
        onErrorValue = error;
      }
    })
  );

  if (root.value.open()) {
    throw new Error(`built useWebSocket accepted a failing initial ${property} getter`);
  }
  if (root.value.error() !== initialStateError || onErrorValue !== initialStateError) {
    throw new Error(`built useWebSocket did not report the initial ${property} failure`);
  }
  if (root.value.status() !== 'CLOSED' || sockets.instances[0].closeCalls !== 1) {
    throw new Error(`built useWebSocket did not roll back the initial ${property} failure`);
  }

  if (!root.value.open() || sockets.instances.length !== 2) {
    throw new Error(`built useWebSocket did not recover after initial ${property} failure`);
  }
  if (root.value.error() !== null || root.value.status() !== 'CONNECTING') {
    throw new Error(`built useWebSocket retained stale ${property} failure state`);
  }
  root.dispose();
  if (sockets.instances[1].closeCalls !== 1) {
    throw new Error(`built useWebSocket lost recovery ownership after ${property} failure`);
  }
}
