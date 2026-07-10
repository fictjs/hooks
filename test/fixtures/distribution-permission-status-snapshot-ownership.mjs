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
  let dispose = () => {};
  let addCalls = 0;
  const status = {
    name: 'camera',
    get state() {
      dispose();
      return 'granted';
    },
    addEventListener() {
      addCalls += 1;
    },
    removeEventListener() {}
  };
  const root = createCompiledRoot(() =>
    usePermission('camera', {
      navigator: { permissions: { query: async () => status } },
      immediate: false
    })
  );
  dispose = root.dispose;

  const result = await root.value.query();
  if (result !== null || root.value.state() !== 'prompt' || addCalls !== 0) {
    throw new Error('built usePermission committed or returned a status after getter disposal');
  }
}

{
  const secondStatus = Object.assign(new globalThis.EventTarget(), {
    name: 'camera',
    state: 'denied'
  });
  let state;
  let nested;
  let queryCalls = 0;
  let resolveSecond = () => {};
  const secondQuery = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  let reenter = false;
  let firstAddCalls = 0;
  const firstStatus = {
    name: 'camera',
    get state() {
      if (reenter) {
        reenter = false;
        nested = state.query();
      }
      return 'granted';
    },
    addEventListener() {
      firstAddCalls += 1;
    },
    removeEventListener() {}
  };
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
  if (result !== null || state.state() !== 'prompt' || queryCalls !== 2 || firstAddCalls !== 0) {
    throw new Error('built usePermission committed or bound a status superseded by its getter');
  }

  resolveSecond(secondStatus);
  if ((await nested) !== secondStatus || state.state() !== 'denied') {
    throw new Error('built usePermission lost the query started by a status getter');
  }
  root.dispose();
}

{
  const listeners = new Set();
  const secondStatus = Object.assign(new globalThis.EventTarget(), {
    name: 'camera',
    state: 'denied'
  });
  let state;
  let nested;
  let queryCalls = 0;
  let resolveSecond = () => {};
  const secondQuery = new Promise((resolve) => {
    resolveSecond = resolve;
  });
  let currentState = 'granted';
  let reenter = false;
  const firstStatus = {
    name: 'camera',
    get state() {
      if (reenter) {
        reenter = false;
        nested = state.query();
      }
      return currentState;
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    update(nextState) {
      currentState = nextState;
      for (const listener of [...listeners]) {
        listener(new globalThis.Event('change'));
      }
    }
  };
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

  if ((await state.query()) !== firstStatus || state.state() !== 'granted') {
    throw new Error('built usePermission did not bind the initial status');
  }
  reenter = true;
  firstStatus.update('denied');
  if (state.state() !== 'granted' || queryCalls !== 2) {
    throw new Error('built usePermission committed a superseded change snapshot');
  }

  resolveSecond(secondStatus);
  if ((await nested) !== secondStatus || state.state() !== 'denied' || listeners.size !== 0) {
    throw new Error('built usePermission lost change snapshot ownership');
  }
  root.dispose();
}
