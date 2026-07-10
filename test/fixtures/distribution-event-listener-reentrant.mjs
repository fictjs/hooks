import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useEventListener } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class TrackingTarget extends globalThis.EventTarget {
  activeListeners = new Set();
  addCalls = 0;
  removeCalls = 0;
  refreshOnRemove = false;
  refresh = () => {};

  addEventListener(type, listener, options) {
    this.addCalls += 1;
    this.activeListeners.add(listener);
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    this.removeCalls += 1;
    super.removeEventListener(type, listener, options);
    this.activeListeners.delete(listener);
    if (this.refreshOnRemove) {
      this.refreshOnRemove = false;
      this.refresh();
    }
  }
}

const target = new TrackingTarget();
let handlerCalls = 0;

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useEventListener(target, 'reentrant-refresh', () => {
      handlerCalls += 1;
    })
  );
} finally {
  __fictPopContext();
}

target.refresh = root.value.refresh;
target.refreshOnRemove = true;
root.value.refresh();

if (target.addCalls !== 2 || target.removeCalls !== 1 || target.activeListeners.size !== 1) {
  throw new Error('built useEventListener left a stale listener after reentrant refresh');
}

target.dispatchEvent(new globalThis.Event('reentrant-refresh'));
if (handlerCalls !== 1) {
  throw new Error('built useEventListener did not retain exactly one live listener');
}

root.value.stop();
if (target.activeListeners.size !== 0 || target.removeCalls !== 2) {
  throw new Error('built useEventListener lost cleanup ownership after reentrant refresh');
}

root.dispose();
