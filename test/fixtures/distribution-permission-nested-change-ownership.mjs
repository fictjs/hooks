import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { usePermission } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const listeners = new Set();
let currentState = 'granted';
let armed = false;
let nested = false;
const status = {
  name: 'camera',
  get state() {
    if (armed && !nested) {
      nested = true;
      currentState = 'denied';
      for (const listener of [...listeners]) {
        listener(new globalThis.Event('change'));
      }
      return 'granted';
    }
    return currentState;
  },
  addEventListener(_type, listener) {
    listeners.add(listener);
  },
  removeEventListener(_type, listener) {
    listeners.delete(listener);
  }
};

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    usePermission('camera', {
      navigator: { permissions: { query: async () => status } },
      immediate: false
    })
  );
} finally {
  __fictPopContext();
}

if ((await root.value.query()) !== status || root.value.state() !== 'granted') {
  throw new Error('built usePermission did not bind the nested-change status');
}
armed = true;
for (const listener of [...listeners]) {
  listener(new globalThis.Event('change'));
}

if (!nested || currentState !== 'denied' || root.value.state() !== 'denied') {
  throw new Error('built usePermission let an outer change overwrite a nested change');
}
root.dispose();
