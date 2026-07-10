import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useSize } = hooks;
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

function createTarget(initialRect) {
  let rect = initialRect;
  return {
    getBoundingClientRect() {
      return {
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top
      };
    },
    setRect(nextRect) {
      rect = nextRect;
    }
  };
}

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let stopUpdate = () => {};
let stopOnWidth = false;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (stopOnWidth && value === 200) {
      stopOnWidth = false;
      stopUpdate();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  const updateWindow = new globalThis.EventTarget();
  const updateTarget = createTarget({ width: 100, height: 60, top: 10, left: 20 });
  const updateRoot = createHook(() => useSize(updateTarget, { window: updateWindow }));
  stopUpdate = updateRoot.value.stop;
  updateTarget.setRect({ width: 200, height: 120, top: 30, left: 40 });
  stopOnWidth = true;
  updateWindow.dispatchEvent(new globalThis.Event('resize'));

  if (
    updateRoot.value.active() ||
    updateRoot.value.width() !== 200 ||
    updateRoot.value.height() !== 60 ||
    updateRoot.value.top() !== 10 ||
    updateRoot.value.left() !== 20 ||
    updateRoot.value.x() !== 20 ||
    updateRoot.value.y() !== 10
  ) {
    throw new Error('built useSize continued a resize update after stop');
  }
  updateRoot.dispose();

  const setupWindow = new globalThis.EventTarget();
  const listenerSets = new Map();
  const addEventListener = setupWindow.addEventListener.bind(setupWindow);
  const removeEventListener = setupWindow.removeEventListener.bind(setupWindow);
  let stopSetup = () => {};
  let stopOnResizeAdd = false;
  setupWindow.addEventListener = (type, listener, options) => {
    const listeners = listenerSets.get(type) ?? new Set();
    listeners.add(listener);
    listenerSets.set(type, listeners);
    addEventListener(type, listener, options);
    if (stopOnResizeAdd && type === 'resize') {
      stopOnResizeAdd = false;
      stopSetup();
    }
  };
  setupWindow.removeEventListener = (type, listener, options) => {
    listenerSets.get(type)?.delete(listener);
    removeEventListener(type, listener, options);
  };
  const setupTarget = createTarget({ width: 100, height: 60, top: 0, left: 0 });
  const setupRoot = createHook(() => useSize(setupTarget, { window: setupWindow }));
  stopSetup = setupRoot.value.stop;
  stopOnResizeAdd = true;
  setupRoot.value.refresh();

  if (
    setupRoot.value.active() ||
    listenerSets.get('resize')?.size !== 0 ||
    listenerSets.get('scroll')?.size !== 0
  ) {
    throw new Error('built useSize leaked listeners after registration-triggered stop');
  }
  setupRoot.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
