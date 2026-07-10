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
  let dispose = () => {};
  const sockets = createMockWebSocketConstructor();
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      serialize(payload) {
        dispose();
        return payload;
      }
    })
  );
  dispose = root.dispose;
  root.value.open();
  sockets.instances[0].open();

  if (root.value.send('terminal-send') || sockets.instances[0].sendCalls.length !== 0) {
    throw new Error('built useWebSocket sent after terminal serialization');
  }
  if (sockets.instances[0].closeCalls !== 1 || root.value.status() !== 'CLOSED') {
    throw new Error('built useWebSocket did not remain terminal after serialization');
  }
}

{
  let root;
  let armed = false;
  const sockets = createMockWebSocketConstructor();
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      serialize(payload) {
        if (armed) {
          armed = false;
          root.value.reconnect();
        }
        return payload;
      }
    })
  );
  root.value.open();
  sockets.instances[0].open();
  armed = true;

  if (root.value.send('stale-send') || sockets.instances.length !== 2) {
    throw new Error('built useWebSocket did not invalidate reentrant serialization');
  }
  if (sockets.instances[0].sendCalls.length !== 0 || sockets.instances[0].closeCalls !== 1) {
    throw new Error('built useWebSocket sent through the stale serialized socket');
  }
  root.dispose();
}
