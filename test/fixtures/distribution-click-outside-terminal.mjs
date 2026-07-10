import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClickOutside } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const listeners = new Map();
const windowRef = {
  Event: globalThis.Event,
  MouseEvent: globalThis.MouseEvent,
  addEventListener(type, listener) {
    const registered = listeners.get(type) ?? new Set();
    registered.add(listener);
    listeners.set(type, registered);
  },
  removeEventListener(type, listener) {
    const registered = listeners.get(type);
    registered?.delete(listener);
    if (registered?.size === 0) {
      listeners.delete(type);
    }
  }
};
const documentRef = {
  defaultView: windowRef,
  querySelectorAll() {
    return [];
  }
};
const target = {
  contains(node) {
    return node === target;
  }
};
const outside = {};
let controls;
let restartOnRead = false;
let handlerCalls = 0;

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useClickOutside(
      () => {
        if (restartOnRead) {
          restartOnRead = false;
          controls.stop();
          controls.start();
        }
        return target;
      },
      () => {
        handlerCalls += 1;
      },
      { window: windowRef, document: documentRef }
    )
  );
} finally {
  __fictPopContext();
}
controls = root.value;

const pointerDown = {
  target: outside,
  composedPath() {
    return [];
  }
};
for (const listener of listeners.get('pointerdown') ?? []) {
  listener(pointerDown);
}
const clickListener = [...(listeners.get('click') ?? [])][0];
restartOnRead = true;
clickListener({
  target: outside,
  composedPath() {
    return [];
  }
});

if (!controls.active() || handlerCalls !== 0) {
  throw new Error('built useClickOutside continued a stale click operation');
}

root.dispose();
