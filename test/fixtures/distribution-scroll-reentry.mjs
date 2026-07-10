import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useScroll, useWindowScroll } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createWindowTarget() {
  const target = new EventTarget();
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
  target.dispatchEvent(new Event('scroll'));

  if (root.value.x() !== 30 || root.value.y() !== 40) {
    throw new Error('built scroll hook let a stale operation overwrite a nested refresh');
  }
  root.dispose();
}
