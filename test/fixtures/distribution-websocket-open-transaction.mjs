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
    useWebSocket(
      () => {
        if (armed) {
          armed = false;
          root.value.close();
        }
        return 'ws://fixture.test';
      },
      { webSocket: sockets.Constructor, immediate: false }
    )
  );
  armed = true;

  if (root.value.open() || sockets.instances.length !== 0 || root.value.status() !== 'CLOSED') {
    throw new Error('built useWebSocket opened after url resolution was invalidated');
  }
  root.dispose();
}

{
  let root;
  let openReentrantly = () => false;
  let constructions = 0;
  const sockets = createMockWebSocketConstructor();
  const ReentrantConstructor = function ReentrantConstructor(url, protocols) {
    constructions += 1;
    const currentSocket = new sockets.Constructor(url, protocols);
    if (constructions === 1) {
      openReentrantly();
    }
    return currentSocket;
  };
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: ReentrantConstructor,
      immediate: false
    })
  );
  openReentrantly = root.value.open;

  if (!root.value.open() || sockets.instances.length !== 2) {
    throw new Error('built useWebSocket did not preserve the reentrant constructor open');
  }
  if (sockets.instances[0].closeCalls !== 1 || sockets.instances[1].closeCalls !== 0) {
    throw new Error('built useWebSocket retained the stale constructor result');
  }
  root.dispose();
  if (sockets.instances[1].closeCalls !== 1) {
    throw new Error('built useWebSocket lost ownership of the reentrant socket');
  }
}

{
  let root;
  let dispose = () => {};
  const sockets = createMockWebSocketConstructor();
  const DisposingConstructor = function DisposingConstructor(url, protocols) {
    const currentSocket = new sockets.Constructor(url, protocols);
    dispose();
    return currentSocket;
  };
  root = createOwnedRoot(() =>
    useWebSocket('ws://fixture.test', {
      webSocket: DisposingConstructor,
      immediate: false
    })
  );
  dispose = root.dispose;

  if (root.value.open() || sockets.instances[0].closeCalls !== 1) {
    throw new Error('built useWebSocket retained a constructor result after disposal');
  }
}
