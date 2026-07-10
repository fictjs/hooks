import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useAsyncState } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const executionError = new Error('execution failed');
let executorCalls = 0;
let onErrorCalls = 0;
let dispose = () => {};
let armed = false;
const previousHook = globalThis.__FICT_DEVTOOLS_HOOK__;
globalThis.__FICT_DEVTOOLS_HOOK__ = {
  registerSignal() {},
  updateSignal(_id, value) {
    if (armed && value === executionError) {
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
    root = createRoot(() =>
      useAsyncState(
        async () => {
          executorCalls += 1;
          throw executionError;
        },
        'initial',
        {
          onError() {
            onErrorCalls += 1;
          }
        }
      )
    );
  } finally {
    __fictPopContext();
  }

  dispose = root.dispose;
  armed = true;
  let rejectedError;
  try {
    await root.value.execute();
  } catch (error) {
    rejectedError = error;
  }

  if (rejectedError !== executionError || root.value.error() !== executionError) {
    throw new Error('built useAsyncState did not preserve its execution failure');
  }
  if (root.value.state() !== 'initial' || root.value.isLoading() || onErrorCalls !== 0) {
    throw new Error('built useAsyncState called onError or failed to settle after disposal');
  }

  const terminalResult = await root.value.execute();
  if (terminalResult !== 'initial' || executorCalls !== 1) {
    throw new Error('built useAsyncState restarted after disposal');
  }
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
