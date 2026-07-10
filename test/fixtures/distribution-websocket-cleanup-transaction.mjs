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
    remove(socket) {
      if (armed && socket === sockets.instances[0]) {
        armed = false;
        root.value.open();
      }
    }
  });
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
  root.value.open();
  armed = true;
  sockets.instances[0].serverClose();

  if (sockets.instances.length !== 2 || sockets.instances[0].removeCalls !== 4) {
    throw new Error('built useWebSocket did not complete reentrant old listener cleanup');
  }
  root.dispose();
  if (sockets.instances[1].removeCalls !== 4 || sockets.instances[1].closeCalls !== 1) {
    throw new Error('built useWebSocket lost replacement cleanup ownership');
  }
}

{
  let failCleanup = false;
  const cleanupError = new Error('listener cleanup failed');
  const sockets = createMockWebSocketConstructor({
    remove() {
      if (failCleanup) {
        failCleanup = false;
        throw cleanupError;
      }
    }
  });
  const root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: sockets.Constructor,
      immediate: false
    })
  );
  root.value.open();
  sockets.instances[0].open();
  failCleanup = true;

  try {
    root.dispose();
  } catch (error) {
    throw new Error('built useWebSocket exposed listener cleanup failure', { cause: error });
  }
  if (sockets.instances[0].removeCalls !== 4 || sockets.instances[0].listenerCount() !== 0) {
    throw new Error('built useWebSocket stopped after one listener cleanup failure');
  }
  if (sockets.instances[0].closeCalls !== 1 || root.value.status() !== 'CLOSED') {
    throw new Error('built useWebSocket did not finish terminal cleanup after removal failure');
  }
}
