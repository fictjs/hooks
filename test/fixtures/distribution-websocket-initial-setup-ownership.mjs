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

for (const trigger of ['readyState', 'CONNECTING', 'status']) {
  let closeDuringSetup = () => {};
  let armed = true;
  let closeCallbacks = 0;
  const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
  globalThis.__FICT_DEVTOOLS_HOOK__ = {
    registerSignal() {},
    updateSignal(_id, value) {
      if (trigger === 'status' && armed && value === 'CONNECTING') {
        armed = false;
        closeDuringSetup();
      }
    },
    registerComputed() {},
    updateComputed() {},
    registerEffect() {},
    effectRun() {}
  };

  try {
    const sockets = createMockWebSocketConstructor();
    const ConfiguringSocket = function ConfiguringSocket(url, protocols) {
      const currentSocket = new sockets.Constructor(url, protocols);
      let readyState = currentSocket.readyState;
      currentSocket.close = () => {
        currentSocket.closeCalls += 1;
        readyState = currentSocket.CLOSING;
      };
      Object.defineProperty(currentSocket, 'readyState', {
        configurable: true,
        get() {
          if (trigger === 'readyState' && armed) {
            armed = false;
            closeDuringSetup();
          }
          return readyState;
        },
        set(value) {
          readyState = value;
        }
      });
      if (trigger === 'CONNECTING') {
        Object.defineProperty(currentSocket, 'CONNECTING', {
          configurable: true,
          get() {
            if (armed) {
              armed = false;
              closeDuringSetup();
            }
            return 0;
          }
        });
      }
      return currentSocket;
    };
    const root = createOwnedRoot(() =>
      useWebSocket('ws://fixture.test', {
        webSocket: ConfiguringSocket,
        immediate: false,
        onClose() {
          closeCallbacks += 1;
        }
      })
    );
    closeDuringSetup = root.value.close;

    if (!root.value.open()) {
      throw new Error(`built useWebSocket lost ${trigger} close ownership`);
    }
    const currentSocket = sockets.instances[0];
    if (
      root.value.status() !== 'CLOSING' ||
      currentSocket.addCalls !== 1 ||
      currentSocket.listenerCount() !== 1 ||
      currentSocket.closeCalls !== 1
    ) {
      throw new Error(`built useWebSocket overwrote or leaked ${trigger} setup state`);
    }

    currentSocket.serverClose();
    if (
      root.value.status() !== 'CLOSED' ||
      currentSocket.listenerCount() !== 0 ||
      currentSocket.removeCalls !== 1 ||
      closeCallbacks !== 1
    ) {
      throw new Error(`built useWebSocket missed the ${trigger} close event`);
    }
    root.dispose();
  } finally {
    globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
  }
}
