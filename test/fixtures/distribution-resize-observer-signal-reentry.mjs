import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useResizeObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class TrackingResizeObserver {
  static instances = [];

  constructor() {
    this.disconnectCalls = 0;
    TrackingResizeObserver.instances.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnectCalls += 1;
  }
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let controls;
let restart = false;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (restart && value === false) {
      restart = false;
      controls.start();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  __fictPushContext();
  let root;
  try {
    root = createRoot(() =>
      useResizeObserver({}, undefined, { window: { ResizeObserver: TrackingResizeObserver } })
    );
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  restart = true;
  controls.stop();
  if (
    !controls.active() ||
    TrackingResizeObserver.instances.length !== 1 ||
    TrackingResizeObserver.instances[0].disconnectCalls !== 0
  ) {
    throw new Error('built useResizeObserver lost a signal-notification restart');
  }

  controls.stop();
  if (TrackingResizeObserver.instances[0].disconnectCalls !== 1) {
    throw new Error('built useResizeObserver lost cleanup ownership after signal restart');
  }
  root.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
