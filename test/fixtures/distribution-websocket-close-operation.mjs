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
  let armed = false;
  const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
  globalThis.__FICT_DEVTOOLS_HOOK__ = {
    registerSignal() {},
    updateSignal(_id, value) {
      if (armed && value === 'CLOSING') {
        armed = false;
        dispose();
      }
    },
    registerComputed() {},
    updateComputed() {},
    registerEffect() {},
    effectRun() {}
  };
  try {
    const sockets = createMockWebSocketConstructor();
    root = createOwnedRoot(() =>
      useWebSocket('ws://fixture.test', {
        webSocket: sockets.Constructor,
        immediate: false
      })
    );
    dispose = root.dispose;
    root.value.open();
    sockets.instances[0].open();
    armed = true;
    root.value.close();

    if (sockets.instances[0].closeCalls !== 1 || root.value.status() !== 'CLOSED') {
      throw new Error('built useWebSocket continued close after terminal CLOSING update');
    }
  } finally {
    globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
  }
}

{
  let root;
  let armed = false;
  const closeError = new Error('close failed after replacement');
  const sockets = createMockWebSocketConstructor({
    close(socket) {
      if (armed && socket === sockets.instances[0]) {
        armed = false;
        root.value.open();
        throw closeError;
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
  sockets.instances[0].open();
  armed = true;
  root.value.close();

  if (sockets.instances.length !== 2 || root.value.status() !== 'CONNECTING') {
    throw new Error('built useWebSocket rolled back reentrant replacement state');
  }
  if (root.value.error() !== null || sockets.instances[1].listenerCount() !== 4) {
    throw new Error('built useWebSocket lost reentrant replacement ownership');
  }
  root.dispose();
}
