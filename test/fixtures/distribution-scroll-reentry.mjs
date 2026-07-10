import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useScroll, useWindowScroll } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createWindowTarget() {
  const target = new globalThis.EventTarget();
  target.pageXOffset = 0;
  target.pageYOffset = 0;
  return target;
}

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

for (const useHook of [
  (target, options) => useScroll({ ...options, target, window: target }),
  (target, options) => useWindowScroll({ ...options, window: target })
]) {
  const target = createWindowTarget();
  let controls;
  let refreshNested = false;
  const root = createCompiledRoot(() => {
    controls = useHook(target, {
      shouldUpdate(next) {
        if (refreshNested && next.x === 10) {
          refreshNested = false;
          target.pageXOffset = 30;
          target.pageYOffset = 40;
          controls.refresh();
        }
        return true;
      }
    });
    return controls;
  });

  refreshNested = true;
  target.pageXOffset = 10;
  target.pageYOffset = 20;
  target.dispatchEvent(new globalThis.Event('scroll'));

  if (root.value.x() !== 30 || root.value.y() !== 40) {
    throw new Error('built scroll hook let a stale operation overwrite a nested refresh');
  }
  root.dispose();
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
try {
  for (const useHook of [
    (target, options) => useScroll({ ...options, target, window: target }),
    (target, options) => useWindowScroll({ ...options, window: target })
  ]) {
    const target = createWindowTarget();
    let controls;
    let refreshOnX = false;
    globalThis.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal() {},
      updateSignal(_id, value) {
        if (refreshOnX && value === 10) {
          refreshOnX = false;
          controls.refresh();
        }
      },
      registerComputed() {},
      updateComputed() {},
      registerEffect() {},
      effectRun() {}
    };
    const root = createCompiledRoot(() => {
      controls = useHook(target, {});
      return controls;
    });
    target.pageXOffset = 10;
    target.pageYOffset = 20;
    refreshOnX = true;

    target.dispatchEvent(new globalThis.Event('scroll'));

    if (root.value.x() !== 10 || root.value.y() !== 20) {
      throw new Error('built scroll hook split coordinates during a nested signal refresh');
    }
    root.value.refresh();
    if (root.value.x() !== 10 || root.value.y() !== 20) {
      throw new Error('built scroll hook retained an irreparable split coordinate snapshot');
    }
    root.dispose();
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
