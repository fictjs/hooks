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

class AdversarialAbortSignal {
  aborted = false;
  reason;
  addError;
  removeError;
  listeners = new Set();

  addEventListener(type, listener) {
    if (type !== 'abort' || !listener) {
      return;
    }
    this.listeners.add(listener);
    if (this.addError) {
      throw this.addError;
    }
  }

  removeEventListener(type, listener) {
    if (type !== 'abort' || !listener) {
      return;
    }
    if (this.removeError) {
      throw this.removeError;
    }
    this.listeners.delete(listener);
  }

  abort(reason) {
    this.aborted = true;
    this.reason = reason;
    for (const listener of [...this.listeners]) {
      if (typeof listener === 'function') {
        listener.call(this, new globalThis.Event('abort'));
      } else {
        listener.handleEvent(new globalThis.Event('abort'));
      }
    }
  }
}

const originalAnyDescriptor = Object.getOwnPropertyDescriptor(globalThis.AbortSignal, 'any');
Object.defineProperty(globalThis.AbortSignal, 'any', {
  configurable: true,
  value: undefined
});

try {
  const addError = new Error('add failed');
  const firstSignal = new AdversarialAbortSignal();
  const failingAddSignal = new AdversarialAbortSignal();
  failingAddSignal.addError = addError;
  let setupFetchCalls = 0;
  const setupRoot = createHook(() =>
    useFetch('https://example.com', {
      fetch: async () => {
        setupFetchCalls += 1;
        return new globalThis.Response('unexpected');
      },
      immediate: false,
      initialData: 'initial',
      init: { signal: firstSignal }
    })
  );
  const setupResult = await setupRoot.value.execute({ signal: failingAddSignal });
  if (
    setupResult !== 'initial' ||
    setupRoot.value.error() !== addError ||
    setupFetchCalls !== 0 ||
    firstSignal.listeners.size !== 0 ||
    failingAddSignal.listeners.size !== 0 ||
    setupRoot.value.isLoading()
  ) {
    throw new Error('built useFetch leaked a partially registered fallback signal');
  }
  setupRoot.dispose();

  const removeError = new Error('remove failed');
  const failingRemoveSignal = new AdversarialAbortSignal();
  const laterSignal = new AdversarialAbortSignal();
  failingRemoveSignal.removeError = removeError;
  let mergedSignal;
  const abortRoot = createHook(() =>
    useFetch('https://example.com', {
      fetch: async (_input, init) => {
        mergedSignal = init.signal;
        return new Promise(() => {});
      },
      immediate: false,
      initialData: 'initial',
      init: { signal: failingRemoveSignal }
    })
  );
  const pending = abortRoot.value.execute({ signal: laterSignal });
  let abortError;
  try {
    failingRemoveSignal.abort(removeError);
  } catch (error) {
    abortError = error;
  }
  if (abortError) {
    throw new Error('built useFetch exposed a fallback listener cleanup failure', {
      cause: abortError
    });
  }
  const abortResult = await pending;
  if (
    abortResult !== 'initial' ||
    !mergedSignal?.aborted ||
    !abortRoot.value.aborted() ||
    abortRoot.value.isLoading() ||
    laterSignal.listeners.size !== 0
  ) {
    throw new Error('built useFetch did not finish fallback abort cleanup');
  }
  abortRoot.dispose();
} finally {
  if (originalAnyDescriptor) {
    Object.defineProperty(globalThis.AbortSignal, 'any', originalAnyDescriptor);
  }
}
