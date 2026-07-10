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

for (const operation of ['dispose', 'reconnect']) {
  for (const callbackName of ['onOpen', 'onMessage', 'onError', 'onClose']) {
    const sockets = createMockWebSocketConstructor();
    let callbackCalls = 0;
    let invalidate = () => {};
    const options = {
      webSocket: sockets.Constructor,
      immediate: false
    };
    Object.defineProperty(options, callbackName, {
      configurable: true,
      get() {
        invalidate();
        return () => {
          callbackCalls += 1;
        };
      }
    });
    const root = createOwnedRoot(() => useWebSocket('ws://fixture.test', options));
    invalidate = operation === 'dispose' ? root.dispose : root.value.reconnect;
    root.value.open();
    const currentSocket = sockets.instances[0];

    switch (callbackName) {
      case 'onOpen':
        currentSocket.open();
        break;
      case 'onMessage':
        currentSocket.open();
        currentSocket.message('message');
        break;
      case 'onError':
        currentSocket.emit('error');
        break;
      case 'onClose':
        currentSocket.serverClose();
        break;
    }

    if (callbackCalls !== 0) {
      throw new Error(`built useWebSocket invoked ${operation}-invalidated ${callbackName}`);
    }
    if (operation === 'reconnect') {
      if (
        sockets.instances.length !== 2 ||
        sockets.instances[1].listenerCount() !== 4 ||
        root.value.status() !== 'CONNECTING'
      ) {
        throw new Error(`built useWebSocket lost ${callbackName} replacement ownership`);
      }
      root.dispose();
    } else if (root.value.status() !== 'CLOSED') {
      throw new Error(`built useWebSocket continued after terminal ${callbackName} getter`);
    }
  }
}
