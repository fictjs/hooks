import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useIntersectionObserver, useMutationObserver, useResizeObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createHook(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

function createTrackingObserver() {
  return class TrackingObserver {
    static instances = [];
    static triggerDuringObserve = false;

    constructor(callback) {
      this.callback = callback;
      this.disconnectCalls = 0;
      this.targets = new Set();
      TrackingObserver.instances.push(this);
    }

    observe(target) {
      if (TrackingObserver.triggerDuringObserve) {
        this.callback([], this);
      }
      this.targets.add(target);
    }

    disconnect() {
      this.disconnectCalls += 1;
      this.targets.clear();
    }
  };
}

const scenarios = [
  ['ResizeObserver', useResizeObserver],
  ['MutationObserver', useMutationObserver],
  ['IntersectionObserver', useIntersectionObserver]
];

for (const [constructorName, useObserver] of scenarios) {
  const Observer = createTrackingObserver();
  const first = {};
  const second = {};
  const stateRef = {};
  let refreshed = false;
  const root = createHook(() =>
    useObserver(
      [first, second],
      () => {
        if (!refreshed) {
          refreshed = true;
          stateRef.current.refresh();
        }
      },
      { window: { [constructorName]: Observer } }
    )
  );
  stateRef.current = root.value;
  Observer.triggerDuringObserve = true;

  root.value.refresh();

  if (Observer.instances.length !== 3) {
    throw new Error(`built use${constructorName} created an unexpected observer count`);
  }
  const [initialObserver, staleObserver, currentObserver] = Observer.instances;
  if (initialObserver.disconnectCalls !== 1 || initialObserver.targets.size !== 0) {
    throw new Error(`built use${constructorName} did not clean its initial observer`);
  }
  if (staleObserver.disconnectCalls !== 2 || staleObserver.targets.size !== 0) {
    throw new Error(`built use${constructorName} leaked a post-disconnect registration`);
  }
  if (
    currentObserver.disconnectCalls !== 0 ||
    currentObserver.targets.size !== 2 ||
    !currentObserver.targets.has(first) ||
    !currentObserver.targets.has(second)
  ) {
    throw new Error(`built use${constructorName} disturbed the replacement observer`);
  }

  root.value.stop();
  if (currentObserver.disconnectCalls !== 1 || currentObserver.targets.size !== 0) {
    throw new Error(`built use${constructorName} did not clean its current observer`);
  }
  root.dispose();
}
