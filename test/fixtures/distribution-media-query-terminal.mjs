import { createRequire } from 'node:module';
import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useMediaQuery } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;
const advanced =
  globalThis.process.argv[2] === 'cjs'
    ? createRequire(import.meta.url)('@fictjs/runtime/advanced')
    : await import('@fictjs/runtime/advanced');

function createHook(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

const query = advanced.createSignal('first');
let disposeSetup = () => {};
let disposeOnAdd = false;
const listenerSets = new Map();
const setupWindow = {
  matchMedia(value) {
    const listeners = new Set();
    listenerSets.set(value, listeners);
    return {
      matches: false,
      addEventListener(_type, listener) {
        listeners.add(listener);
        if (disposeOnAdd) {
          disposeOnAdd = false;
          disposeSetup();
        }
      },
      removeEventListener(_type, listener) {
        listeners.delete(listener);
      }
    };
  }
};
const setupRoot = createHook(() => useMediaQuery(() => query(), { window: setupWindow }));
disposeSetup = setupRoot.dispose;
disposeOnAdd = true;
query('second');
await Promise.resolve();
await Promise.resolve();

if (listenerSets.get('first')?.size !== 0 || listenerSets.get('second')?.size !== 0) {
  throw new Error('built useMediaQuery leaked a listener registered during disposal');
}

const callbackListeners = new Set();
const callbackList = {
  matches: false,
  addEventListener(_type, listener) {
    callbackListeners.add(listener);
  },
  removeEventListener(_type, listener) {
    callbackListeners.delete(listener);
  }
};
const callbackRoot = createHook(() =>
  useMediaQuery('screen', { window: { matchMedia: () => callbackList } })
);
const event = {};
Object.defineProperty(event, 'matches', {
  get() {
    callbackRoot.dispose();
    return true;
  }
});
for (const listener of [...callbackListeners]) {
  listener(event);
}

if (callbackRoot.value.matches()) {
  throw new Error('built useMediaQuery updated after event-triggered disposal');
}
