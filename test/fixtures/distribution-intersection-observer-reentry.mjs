import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useIntersectionObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class TrackingIntersectionObserver {
  static instances = [];

  constructor() {
    this.disconnectCalls = 0;
    TrackingIntersectionObserver.instances.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnectCalls += 1;
  }
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let controls;
let refreshOnRead = false;
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
      useIntersectionObserver(
        () => {
          if (refreshOnRead) {
            refreshOnRead = false;
            controls.refresh();
          }
          return {};
        },
        undefined,
        { window: { IntersectionObserver: TrackingIntersectionObserver } }
      )
    );
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  refreshOnRead = true;
  controls.refresh();
  if (
    TrackingIntersectionObserver.instances.length !== 2 ||
    TrackingIntersectionObserver.instances[0].disconnectCalls !== 1 ||
    TrackingIntersectionObserver.instances[1].disconnectCalls !== 0
  ) {
    throw new Error('built useIntersectionObserver lost reentrant refresh ownership');
  }

  restart = true;
  controls.stop();
  if (!controls.active() || TrackingIntersectionObserver.instances[1].disconnectCalls !== 0) {
    throw new Error('built useIntersectionObserver lost a signal-notification restart');
  }

  controls.stop();
  if (TrackingIntersectionObserver.instances[1].disconnectCalls !== 1) {
    throw new Error('built useIntersectionObserver lost final cleanup ownership');
  }
  root.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
