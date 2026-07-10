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

for (const trigger of ['getter', 'setter']) {
  let closeDuringSetup = () => {};
  let closeCallbacks = 0;
  const sockets = createMockWebSocketConstructor({
    binaryType() {
      if (trigger === 'setter') {
        closeDuringSetup();
      }
    },
    close(socket) {
      socket.readyState = socket.CLOSING;
    }
  });
  const options = {
    webSocket: sockets.Constructor,
    immediate: false,
    onClose() {
      closeCallbacks += 1;
    }
  };
  if (trigger === 'getter') {
    Object.defineProperty(options, 'binaryType', {
      configurable: true,
      get() {
        closeDuringSetup();
        return 'arraybuffer';
      }
    });
  } else {
    options.binaryType = 'arraybuffer';
  }
  const root = createOwnedRoot(() => useWebSocket('ws://fixture.test', options));
  closeDuringSetup = root.value.close;

  if (!root.value.open()) {
    throw new Error(`built useWebSocket dropped the pending ${trigger} close owner`);
  }
  const socket = sockets.instances[0];
  if (
    root.value.status() !== 'CLOSING' ||
    socket.listenerCount() !== 1 ||
    socket.addCalls !== 1 ||
    socket.removeCalls !== 0 ||
    socket.closeCalls !== 1 ||
    closeCallbacks !== 0
  ) {
    throw new Error(`built useWebSocket abandoned the pending ${trigger} close listener`);
  }

  socket.serverClose();
  if (
    root.value.status() !== 'CLOSED' ||
    socket.listenerCount() !== 0 ||
    socket.removeCalls !== 1 ||
    socket.closeCalls !== 1 ||
    closeCallbacks !== 1
  ) {
    throw new Error(`built useWebSocket did not finish the asynchronous ${trigger} close`);
  }

  root.dispose();
  if (socket.removeCalls !== 1 || socket.closeCalls !== 1 || closeCallbacks !== 1) {
    throw new Error(`built useWebSocket repeated asynchronous ${trigger} close cleanup`);
  }
}
