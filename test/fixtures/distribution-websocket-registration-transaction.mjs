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
  const sockets = createMockWebSocketConstructor({
    binaryType() {
      if (armed) {
        armed = false;
        root.dispose();
      }
    }
  });
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false,
      binaryType: 'arraybuffer'
    })
  );
  armed = true;

  if (
    root.value.open() ||
    sockets.instances[0].addCalls !== 1 ||
    sockets.instances[0].removeCalls !== 1
  ) {
    throw new Error('built useWebSocket did not roll back provisional binaryType setup');
  }
}

{
  let root;
  let armed = false;
  const sockets = createMockWebSocketConstructor({
    add() {
      if (armed) {
        armed = false;
        root.dispose();
      }
    }
  });
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
  armed = true;

  if (root.value.open()) {
    throw new Error('built useWebSocket retained setup after registration disposal');
  }
  if (sockets.instances[0].addCalls !== 1 || sockets.instances[0].removeCalls !== 1) {
    throw new Error('built useWebSocket did not roll back terminal listener registration');
  }
}

{
  let root;
  let armed = false;
  const sockets = createMockWebSocketConstructor({
    add(socket) {
      if (armed && socket === sockets.instances[0]) {
        armed = false;
        root.value.reconnect();
      }
    }
  });
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
  armed = true;

  if (!root.value.open() || sockets.instances.length !== 2) {
    throw new Error('built useWebSocket lost a registration-time reconnect');
  }
  if (sockets.instances[0].removeCalls !== 1 || sockets.instances[1].listenerCount() !== 4) {
    throw new Error('built useWebSocket retained stale registration ownership');
  }
  root.dispose();
  if (sockets.instances[1].removeCalls !== 4) {
    throw new Error('built useWebSocket lost replacement listener cleanup');
  }
}

{
  const setupError = new Error('listener setup failed');
  const sockets = createMockWebSocketConstructor({
    add(socket) {
      if (socket.addCalls === 2) {
        throw setupError;
      }
    }
  });
  const root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
  let thrown;
  try {
    root.value.open();
  } catch (error) {
    thrown = error;
  }
  if (thrown !== setupError || sockets.instances[0].removeCalls !== 2) {
    throw new Error('built useWebSocket did not preserve and roll back listener setup failure');
  }
  if (sockets.instances[0].listenerCount() !== 0 || sockets.instances[0].closeCalls !== 1) {
    throw new Error('built useWebSocket leaked its failed listener setup');
  }
  root.dispose();
}
