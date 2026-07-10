import { loadDistribution } from './load-distribution.mjs';
import { createMockWebSocketConstructor } from './websocket-test-utils.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWebSocket } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

let root;
let armed = false;
const closeError = new Error('old close failed after replacement');
const sockets = createMockWebSocketConstructor({
  close(socket) {
    if (armed && socket === sockets.instances[0]) {
      armed = false;
      root.value.open();
      throw closeError;
    }
  }
});

__fictPushContext();
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
sockets.instances[0].open();
armed = true;

if (!root.value.reconnect()) {
  throw new Error('built useWebSocket rejected reentrant replacement ownership');
}
if (sockets.instances.length !== 2 || root.value.status() !== 'CONNECTING') {
  throw new Error('built useWebSocket restored stale state after replacement close failure');
}
if (root.value.error() !== null || sockets.instances[1].listenerCount() !== 4) {
  throw new Error('built useWebSocket reported stale error into replacement ownership');
}

root.dispose();
if (sockets.instances[1].removeCalls !== 4 || sockets.instances[1].closeCalls !== 1) {
  throw new Error('built useWebSocket lost replacement after old close failure');
}
