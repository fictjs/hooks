import { loadDistribution } from './load-distribution.mjs';
import { createMockWebSocketConstructor } from './websocket-test-utils.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWebSocket } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

__fictPushContext();
let root;
const sockets = createMockWebSocketConstructor();
try {
  root = createRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
} finally {
  __fictPopContext();
}

root.value.open();
const currentSocket = sockets.instances[0];
let armed = true;
Object.defineProperty(currentSocket, 'readyState', {
  configurable: true,
  get() {
    if (armed) {
      armed = false;
      root.dispose();
    }
    return currentSocket.CONNECTING;
  }
});

let openResult;
try {
  openResult = root.value.open();
} catch (error) {
  throw new Error('built useWebSocket threw after readyState cleared ownership', { cause: error });
}

if (openResult || root.value.status() !== 'CLOSED' || currentSocket.closeCalls !== 1) {
  throw new Error('built useWebSocket continued after a terminal readyState getter');
}
