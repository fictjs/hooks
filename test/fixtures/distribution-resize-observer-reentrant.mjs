import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useResizeObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class ReentrantResizeObserver {
  static instances = [];
  static onDisconnect;

  constructor(callback) {
    this.callback = callback;
    this.disconnectCalls = 0;
    this.observations = [];
    ReentrantResizeObserver.instances.push(this);
  }

  observe(target, options) {
    this.observations.push({ target, options });
  }

  disconnect() {
    this.disconnectCalls += 1;
    ReentrantResizeObserver.onDisconnect?.();
  }
}

const target = {};
const windowRef = { ResizeObserver: ReentrantResizeObserver };

__fictPushContext();
let root;
try {
  root = createRoot(() => useResizeObserver(target, undefined, { window: windowRef }));
} finally {
  __fictPopContext();
}

let refreshOnDisconnect = true;
ReentrantResizeObserver.onDisconnect = () => {
  if (refreshOnDisconnect) {
    refreshOnDisconnect = false;
    root.value.refresh();
  }
};

root.value.refresh();

if (ReentrantResizeObserver.instances.length !== 2) {
  throw new Error('built useResizeObserver let a stale refresh create a third observer');
}
const [initialObserver, currentObserver] = ReentrantResizeObserver.instances;
if (initialObserver.disconnectCalls !== 1 || currentObserver.disconnectCalls !== 0) {
  throw new Error('built useResizeObserver did not preserve reentrant cleanup ownership');
}
if (
  currentObserver.observations.length !== 1 ||
  currentObserver.observations[0].target !== target
) {
  throw new Error('built useResizeObserver did not retain the reentrant observation');
}

root.value.stop();
if (ReentrantResizeObserver.instances.some((observer) => observer.disconnectCalls !== 1)) {
  throw new Error('built useResizeObserver leaked an observer after stop');
}

root.dispose();
