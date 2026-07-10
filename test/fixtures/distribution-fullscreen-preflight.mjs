import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useFullscreen } = hooks;
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

function createFullscreenMock() {
  const documentRef = new globalThis.EventTarget();
  const element = new globalThis.EventTarget();
  documentRef.fullscreenElement = null;
  documentRef.fullscreenEnabled = true;
  documentRef.exitFullscreen = async () => {
    documentRef.fullscreenElement = null;
    documentRef.dispatchEvent(new globalThis.Event('fullscreenchange'));
  };
  Object.defineProperty(documentRef, 'documentElement', {
    configurable: true,
    value: element
  });
  return { documentRef, element };
}

for (const phase of ['target', 'request method']) {
  const { documentRef, element } = createFullscreenMock();
  let requestCalls = 0;
  let dispose = () => {};
  let armed = false;
  const requestFullscreen = async () => {
    requestCalls += 1;
    documentRef.fullscreenElement = element;
    documentRef.dispatchEvent(new globalThis.Event('fullscreenchange'));
  };
  const target = () => {
    if (armed && phase === 'target') {
      dispose();
    }
    return element;
  };
  Object.defineProperty(element, 'requestFullscreen', {
    configurable: true,
    get() {
      if (armed && phase === 'request method') {
        dispose();
      }
      return requestFullscreen;
    }
  });
  const root = createHook(() => useFullscreen({ document: documentRef, target }));
  dispose = root.dispose;
  armed = true;

  const result = await root.value.enter();
  if (
    result !== false ||
    requestCalls !== 0 ||
    documentRef.fullscreenElement !== null ||
    root.value.isFullscreen()
  ) {
    throw new Error(`built useFullscreen continued after ${phase} getter disposal`);
  }
}

for (const phase of ['target', 'request method']) {
  const { documentRef, element } = createFullscreenMock();
  let requestCalls = 0;
  let state;
  let nestedEnter;
  let armed = false;
  const requestFullscreen = async () => {
    requestCalls += 1;
    documentRef.fullscreenElement = element;
    documentRef.dispatchEvent(new globalThis.Event('fullscreenchange'));
  };
  const supersede = () => {
    if (!armed) {
      return;
    }
    armed = false;
    nestedEnter = state.enter();
  };
  const target = () => {
    if (phase === 'target') {
      supersede();
    }
    return element;
  };
  Object.defineProperty(element, 'requestFullscreen', {
    configurable: true,
    get() {
      if (phase === 'request method') {
        supersede();
      }
      return requestFullscreen;
    }
  });
  const root = createHook(() => useFullscreen({ document: documentRef, target }));
  state = root.value;
  armed = true;

  const supersededEnter = state.enter();
  if (!nestedEnter) {
    throw new Error(`built useFullscreen did not start the nested ${phase} operation`);
  }
  const [supersededResult, nestedResult] = await Promise.all([supersededEnter, nestedEnter]);
  if (
    supersededResult !== false ||
    nestedResult !== true ||
    requestCalls !== 1 ||
    documentRef.fullscreenElement !== element
  ) {
    throw new Error(`built useFullscreen continued a superseded ${phase} operation`);
  }
  root.dispose();
}
