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

{
  let root;
  let armed = false;
  const sockets = createMockWebSocketConstructor();
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      deserialize() {
        if (armed) {
          armed = false;
          root.value.reconnect();
        }
        return 'stale-message';
      }
    })
  );
  root.value.open();
  armed = true;
  sockets.instances[0].message('payload');

  if (sockets.instances.length !== 2 || root.value.data() !== null) {
    throw new Error('built useWebSocket committed data after deserialize reconnect');
  }
  if (sockets.instances[0].closeCalls !== 1 || root.value.status() !== 'CONNECTING') {
    throw new Error('built useWebSocket lost deserialize replacement ownership');
  }
  root.dispose();
}

{
  let root;
  let dispose = () => {};
  const sockets = createMockWebSocketConstructor();
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      deserialize() {
        dispose();
        return 'terminal-message';
      }
    })
  );
  dispose = root.dispose;
  root.value.open();
  sockets.instances[0].message('payload');

  if (root.value.data() !== null || root.value.status() !== 'CLOSED') {
    throw new Error('built useWebSocket committed data after terminal deserialize');
  }
  if (sockets.instances[0].closeCalls !== 1) {
    throw new Error('built useWebSocket did not remain terminal after deserialize');
  }
}
