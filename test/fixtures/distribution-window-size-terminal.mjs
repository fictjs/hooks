import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWindowSize } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const windowRef = Object.assign(new globalThis.EventTarget(), {
  innerWidth: 100,
  innerHeight: 200
});
let dispose = () => {};
let armed = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === 300) {
      armed = false;
      dispose();
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
    root = createRoot(() => useWindowSize({ window: windowRef }));
  } finally {
    __fictPopContext();
  }
  dispose = root.dispose;
  windowRef.innerWidth = 300;
  windowRef.innerHeight = 400;
  armed = true;
  windowRef.dispatchEvent(new globalThis.Event('resize'));

  if (root.value.width() !== 300 || root.value.height() !== 200) {
    throw new Error('built useWindowSize continued a resize update after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
