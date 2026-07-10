import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClickOutside } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const listeners = new Map();
let controls;
let stopOnPointerAdd = false;
const windowRef = {
  Event: globalThis.Event,
  MouseEvent: globalThis.MouseEvent,
  addEventListener(type, listener) {
    const registered = listeners.get(type) ?? new Set();
    registered.add(listener);
    listeners.set(type, registered);
    if (stopOnPointerAdd && type === 'pointerdown') {
      stopOnPointerAdd = false;
      controls.stop();
    }
  },
  removeEventListener(type, listener) {
    const registered = listeners.get(type);
    registered?.delete(listener);
    if (registered?.size === 0) listeners.delete(type);
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

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useClickOutside(target, () => {}, { window: windowRef, document: documentRef })
  );
} finally {
  __fictPopContext();
}
controls = root.value;
controls.stop();

stopOnPointerAdd = true;
controls.start();
if (controls.active() || listeners.size !== 0) {
  throw new Error('built useClickOutside continued start after a reentrant stop');
}

root.dispose();
