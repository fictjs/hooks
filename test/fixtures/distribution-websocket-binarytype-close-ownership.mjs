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
      socket.emit('close', { type: 'close', code: 1000, reason: 'setup close' });
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

  if (root.value.open()) {
    throw new Error(`built useWebSocket retained ${trigger} close ownership`);
  }
  const socket = sockets.instances[0];
  if (
    root.value.status() !== 'CLOSED' ||
    socket.listenerCount() !== 0 ||
    socket.addCalls !== 1 ||
    socket.removeCalls !== 1 ||
    socket.closeCalls !== 1 ||
    closeCallbacks !== 1
  ) {
    throw new Error(`built useWebSocket lost or duplicated the ${trigger} setup close`);
  }

  root.dispose();
  if (socket.removeCalls !== 1 || socket.closeCalls !== 1 || closeCallbacks !== 1) {
    throw new Error(`built useWebSocket repeated ${trigger} setup cleanup`);
  }
}
