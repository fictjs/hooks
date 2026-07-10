import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useKeyPress } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const listeners = new Map();
const target = {
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
let controls;
let handlerCalls = 0;

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useKeyPress(
      () => {
        controls.stop();
        controls.start();
        return true;
      },
      () => {
        handlerCalls += 1;
      },
      { target }
    )
  );
} finally {
  __fictPopContext();
}
controls = root.value;

const listener = [...(listeners.get('keydown') ?? [])][0];
listener({
  repeat: false,
  isComposing: false,
  preventDefault() {}
});

if (!controls.active() || handlerCalls !== 0) {
  throw new Error('built useKeyPress continued a stale filter operation');
}

root.dispose();
