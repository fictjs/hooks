import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useAsyncState } = hooks;
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

let disposeLoading = () => {};
let disposeOnLoading = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (disposeOnLoading && value === true) {
      disposeOnLoading = false;
      disposeLoading();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  let loadingExecutorCalls = 0;
  const loadingRoot = createHook(() =>
    useAsyncState(async () => {
      loadingExecutorCalls += 1;
      return 'next';
    }, 'initial')
  );
  disposeLoading = loadingRoot.dispose;
  disposeOnLoading = true;
  const loadingResult = await loadingRoot.value.execute();
  if (
    loadingResult !== 'initial' ||
    loadingExecutorCalls !== 0 ||
    loadingRoot.value.state() !== 'initial' ||
    loadingRoot.value.isLoading()
  ) {
    throw new Error('built useAsyncState continued after loading-triggered disposal');
  }

  let resetRoot;
  let nestedExecution;
  let nestedStarted = false;
  const executionTags = [];
  const resetOptions = {};
  Object.defineProperty(resetOptions, 'resetOnExecute', {
    enumerable: true,
    get() {
      if (!nestedStarted) {
        nestedStarted = true;
        nestedExecution = resetRoot.value.execute('nested');
      }
      return true;
    }
  });
  resetRoot = createHook(() =>
    useAsyncState(
      async (tag) => {
        executionTags.push(tag);
        return tag === 'nested' ? 2 : 1;
      },
      0,
      resetOptions
    )
  );
  const outerResult = await resetRoot.value.execute('outer');
  const nestedResult = await nestedExecution;
  if (
    outerResult !== 0 ||
    nestedResult !== 2 ||
    executionTags.length !== 1 ||
    executionTags[0] !== 'nested' ||
    resetRoot.value.state() !== 2 ||
    resetRoot.value.isLoading()
  ) {
    throw new Error('built useAsyncState continued a superseded option preflight');
  }
  resetRoot.dispose();

  const executionError = new Error('execution failed');
  let disposeError = () => {};
  let onErrorCalls = 0;
  const errorOptions = {};
  Object.defineProperty(errorOptions, 'onError', {
    enumerable: true,
    get() {
      disposeError();
      return () => {
        onErrorCalls += 1;
      };
    }
  });
  const errorRoot = createHook(() =>
    useAsyncState(
      async () => {
        throw executionError;
      },
      'initial',
      errorOptions
    )
  );
  disposeError = errorRoot.dispose;
  let rejectedError;
  try {
    await errorRoot.value.execute();
  } catch (error) {
    rejectedError = error;
  }
  if (
    rejectedError !== executionError ||
    errorRoot.value.error() !== executionError ||
    errorRoot.value.isLoading() ||
    onErrorCalls !== 0
  ) {
    throw new Error('built useAsyncState called an onError getter result after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
