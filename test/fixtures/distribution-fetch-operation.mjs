import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useFetch } = hooks;
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

let startNestedRequest = () => {};
let nestedRequest;
let startOnAborted = false;
let disposeStatus = () => {};
let disposeOnStatus = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (startOnAborted && value === true) {
      startOnAborted = false;
      nestedRequest = startNestedRequest();
    }
    if (disposeOnStatus && value === 201) {
      disposeOnStatus = false;
      disposeStatus();
    }
  },
  registerComputed() {},
  updateComputed() {},
  registerEffect() {},
  effectRun() {}
};

try {
  let fetchCalls = 0;
  const abortRoot = createHook(() =>
    useFetch('https://example.com', {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return new Promise(() => {});
        }
        return new globalThis.Response('latest');
      },
      immediate: false,
      initialData: 'initial'
    })
  );
  startNestedRequest = abortRoot.value.execute;
  const firstRequest = abortRoot.value.execute();
  startOnAborted = true;
  abortRoot.value.abort();
  if (abortRoot.value.aborted() || !abortRoot.value.isLoading()) {
    throw new Error('built useFetch abort overwrote a nested execution');
  }
  const nestedResult = await nestedRequest;
  const firstResult = await firstRequest;
  if (
    nestedResult !== 'latest' ||
    firstResult !== 'initial' ||
    fetchCalls !== 2 ||
    abortRoot.value.data() !== 'latest' ||
    abortRoot.value.isLoading()
  ) {
    throw new Error('built useFetch did not preserve nested abort ownership');
  }
  abortRoot.dispose();

  let disposeInit = () => {};
  let initFetchCalls = 0;
  let laterInitReads = 0;
  const init = {};
  Object.defineProperty(init, 'headers', {
    enumerable: true,
    get() {
      disposeInit();
      return { accept: 'text/plain' };
    }
  });
  Object.defineProperty(init, 'cache', {
    enumerable: true,
    get() {
      laterInitReads += 1;
      return 'no-store';
    }
  });
  const initRoot = createHook(() =>
    useFetch('https://example.com', {
      fetch: async () => {
        initFetchCalls += 1;
        return new globalThis.Response('unexpected');
      },
      immediate: false,
      initialData: 'initial'
    })
  );
  disposeInit = initRoot.dispose;
  const initResult = await initRoot.value.execute(init);
  if (
    initResult !== 'initial' ||
    initFetchCalls !== 0 ||
    laterInitReads !== 0 ||
    !initRoot.value.aborted() ||
    initRoot.value.isLoading()
  ) {
    throw new Error('built useFetch called fetch after an init getter disposed its owner');
  }

  let parseCalls = 0;
  const statusRoot = createHook(() =>
    useFetch('https://example.com', {
      fetch: async () => new globalThis.Response('response', { status: 201 }),
      immediate: false,
      initialData: 'initial',
      parse: async () => {
        parseCalls += 1;
        return 'parsed';
      }
    })
  );
  disposeStatus = statusRoot.dispose;
  disposeOnStatus = true;
  const statusResult = await statusRoot.value.execute();
  if (
    statusResult !== 'initial' ||
    statusRoot.value.status() !== 201 ||
    parseCalls !== 0 ||
    !statusRoot.value.aborted() ||
    statusRoot.value.isLoading()
  ) {
    throw new Error('built useFetch parsed after its status write disposed the owner');
  }

  const requestError = new Error('request failed');
  let disposeError = () => {};
  let onErrorCalls = 0;
  const errorOptions = {
    fetch: async () => {
      throw requestError;
    },
    immediate: false,
    initialData: 'initial'
  };
  Object.defineProperty(errorOptions, 'onError', {
    enumerable: true,
    get() {
      disposeError();
      return () => {
        onErrorCalls += 1;
      };
    }
  });
  const errorRoot = createHook(() => useFetch('https://example.com', errorOptions));
  disposeError = errorRoot.dispose;
  const errorResult = await errorRoot.value.execute();
  if (
    errorResult !== 'initial' ||
    errorRoot.value.error() !== requestError ||
    onErrorCalls !== 0 ||
    !errorRoot.value.aborted() ||
    errorRoot.value.isLoading()
  ) {
    throw new Error('built useFetch called an onError getter result after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
