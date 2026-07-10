import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useNetwork } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const connection = Object.assign(new globalThis.EventTarget(), {
  downlink: 10,
  effectiveType: '4g',
  rtt: 40,
  saveData: false,
  type: 'wifi'
});
const navigatorRef = { onLine: true, connection };
const windowRef = new globalThis.EventTarget();
let dispose = () => {};
let armed = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === false) {
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
    root = createRoot(() => useNetwork({ window: windowRef, navigator: navigatorRef }));
  } finally {
    __fictPopContext();
  }
  dispose = root.dispose;
  navigatorRef.onLine = false;
  connection.downlink = 1;
  armed = true;
  windowRef.dispatchEvent(new globalThis.Event('offline'));

  if (root.value.online() || root.value.downlink() !== 10) {
    throw new Error('built useNetwork continued a composite update after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
