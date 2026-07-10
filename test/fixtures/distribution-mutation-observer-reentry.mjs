import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useMutationObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class TrackingMutationObserver {
  static instances = [];

  constructor() {
    this.disconnectCalls = 0;
    TrackingMutationObserver.instances.push(this);
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
      useMutationObserver(
        () => {
          if (refreshOnRead) {
            refreshOnRead = false;
            controls.refresh();
          }
          return {};
        },
        undefined,
        { window: { MutationObserver: TrackingMutationObserver } }
      )
    );
  } finally {
    __fictPopContext();
  }
  controls = root.value;

  refreshOnRead = true;
  controls.refresh();
  if (
    TrackingMutationObserver.instances.length !== 2 ||
    TrackingMutationObserver.instances[0].disconnectCalls !== 1 ||
    TrackingMutationObserver.instances[1].disconnectCalls !== 0
  ) {
    throw new Error('built useMutationObserver lost reentrant refresh ownership');
  }

  restart = true;
  controls.stop();
  if (!controls.active() || TrackingMutationObserver.instances[1].disconnectCalls !== 0) {
    throw new Error('built useMutationObserver lost a signal-notification restart');
  }

  controls.stop();
  if (TrackingMutationObserver.instances[1].disconnectCalls !== 1) {
    throw new Error('built useMutationObserver lost final cleanup ownership');
  }
  root.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
