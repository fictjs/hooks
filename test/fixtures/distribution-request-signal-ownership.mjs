import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
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

const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
let updateSignal = () => {};
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(id, value) {
    updateSignal(id, value);
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  const requestError = new Error('request failed');
  let onErrorCalls = 0;
  let disposeError = () => {};
  let errorArmed = false;
  updateSignal = (_id, value) => {
    if (errorArmed && value === requestError) {
      errorArmed = false;
      disposeError();
    }
  };
  const errorRoot = createCompiledRoot(() =>
    useRequest(
      async () => {
        throw requestError;
      },
      {
        manual: true,
        onError() {
          onErrorCalls += 1;
        }
      }
    )
  );
  disposeError = errorRoot.dispose;
  errorArmed = true;
  await errorRoot.value.runAsync();
  if (onErrorCalls !== 0 || errorRoot.value.error() !== requestError) {
    throw new Error('built useRequest ran onError after error-triggered disposal');
  }

  let onFinallyCalls = 0;
  let disposeFinally = () => {};
  let finallyArmed = false;
  updateSignal = (_id, value) => {
    if (finallyArmed && value === false) {
      finallyArmed = false;
      disposeFinally();
    }
  };
  const finallyRoot = createCompiledRoot(() =>
    useRequest(async () => 1, {
      manual: true,
      onFinally() {
        onFinallyCalls += 1;
      }
    })
  );
  disposeFinally = finallyRoot.dispose;
  finallyArmed = true;
  const finallyResult = await finallyRoot.value.runAsync();
  if (finallyResult !== 1 || onFinallyCalls !== 0 || finallyRoot.value.loading()) {
    throw new Error('built useRequest ran onFinally after loading-triggered disposal');
  }

  let nestedRequest;
  let nestedArmed = false;
  let state;
  updateSignal = (_id, value) => {
    if (nestedArmed && value === true) {
      nestedArmed = false;
      nestedRequest = state.runAsync('inner');
    }
  };
  const nestedRoot = createCompiledRoot(() =>
    useRequest(async (value) => value, {
      manual: true
    })
  );
  state = nestedRoot.value;
  nestedArmed = true;
  await state.runAsync('outer');
  await nestedRequest;
  if (state.data() !== 'inner' || state.params()?.[0] !== 'inner') {
    throw new Error('built useRequest overwrote nested run params');
  }
  nestedRoot.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
