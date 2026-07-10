import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { usePermission } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

{
  const listeners = new Set();
  let dispose = () => {};
  const status = {
    name: 'camera',
    state: 'granted',
    addEventListener(_type, listener) {
      dispose();
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    }
  };
  const root = createCompiledRoot(() =>
    usePermission('camera', {
      navigator: { permissions: { query: async () => status } },
      immediate: false
    })
  );
  dispose = root.dispose;

  const result = await root.value.query();
  if (result !== null || listeners.size !== 0 || root.value.state() !== 'granted') {
    throw new Error('built usePermission leaked a listener registered after disposal');
  }
}

{
  const listeners = new Set();
  let removeCalls = 0;
  const registrationError = new Error('permission listener registration failed');
  const status = {
    name: 'camera',
    state: 'granted',
    addEventListener(_type, listener) {
      listeners.add(listener);
      throw registrationError;
    },
    removeEventListener(_type, listener) {
      removeCalls += 1;
      listeners.delete(listener);
      throw new Error('permission listener rollback failed');
    }
  };
  const root = createCompiledRoot(() =>
    usePermission('camera', {
      navigator: { permissions: { query: async () => status } },
      immediate: false
    })
  );

  const result = await root.value.query();
  if (result !== null || removeCalls !== 1 || listeners.size !== 0) {
    throw new Error('built usePermission did not roll back failed listener registration');
  }
  root.dispose();
}

{
  const firstListeners = new Set();
  const firstStatus = {
    name: 'camera',
    state: 'granted',
    addEventListener(_type, listener) {
      firstListeners.add(listener);
    },
    removeEventListener(_type, listener) {
      firstListeners.delete(listener);
    },
    update(nextState) {
      this.state = nextState;
      for (const listener of [...firstListeners]) listener(new globalThis.Event('change'));
    }
  };
  const secondStatus = new globalThis.EventTarget();
  secondStatus.name = 'camera';
  secondStatus.state = 'denied';
  let resolveSecond = () => {};
  const secondQuery = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  let queryCalls = 0;
  let state;
  let nested;
  let reenter = false;
  const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
  globalThis.__FICT_DEVTOOLS_HOOK__ = {
    registerSignal() {},
    updateSignal(_id, value) {
      if (reenter && value === 'granted') {
        reenter = false;
        nested = state.query();
      }
    },
    registerComputed() {},
    updateComputed() {},
    registerEffect() {},
    effectRun() {}
  };

  try {
    const root = createCompiledRoot(() =>
      usePermission('camera', {
        navigator: {
          permissions: {
            query() {
              queryCalls += 1;
              return queryCalls === 1 ? Promise.resolve(firstStatus) : secondQuery;
            }
          }
        },
        immediate: false
      })
    );
    state = root.value;
    reenter = true;

    const result = await state.query();
    firstStatus.update('denied');
    if (result !== null || firstListeners.size !== 0 || state.state() !== 'granted') {
      throw new Error('built usePermission bound a superseded status listener');
    }

    resolveSecond(secondStatus);
    const nestedResult = await nested;
    if (nestedResult !== secondStatus || state.state() !== 'denied') {
      throw new Error('built usePermission lost the superseding permission query');
    }
    root.dispose();
  } finally {
    globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
  }
}
