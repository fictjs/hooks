import { loadDistribution } from './load-distribution.mjs';
import { createMockWebSocketConstructor } from './websocket-test-utils.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWebSocket } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

let root;
let armed = false;
let onCloseCalls = 0;
const sockets = createMockWebSocketConstructor({
  remove(socket) {
    if (armed && socket === sockets.instances[0]) {
      armed = false;
      root.value.open();
    }
  }
});

__fictPushContext();
try {
  root = createRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      onClose() {
        onCloseCalls += 1;
      }
    })
  );
} finally {
  __fictPopContext();
}

root.value.open();
armed = true;
sockets.instances[0].serverClose();

if (sockets.instances.length !== 2 || root.value.status() !== 'CONNECTING') {
  throw new Error('built useWebSocket let an old close overwrite replacement status');
}
if (onCloseCalls !== 0 || sockets.instances[1].listenerCount() !== 4) {
  throw new Error('built useWebSocket continued the old close after replacement setup');
}

root.dispose();
if (sockets.instances[1].removeCalls !== 4 || sockets.instances[1].closeCalls !== 1) {
  throw new Error('built useWebSocket lost replacement ownership after close reentry');
}
