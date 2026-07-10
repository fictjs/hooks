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
  const mutateCache = new Map();
  let mutateState;
  let mutateArmed = false;
  updateSignal = (_id, value) => {
    if (mutateArmed && value === 1) {
      mutateArmed = false;
      mutateState.mutate(2);
    }
  };
  const mutateRoot = createCompiledRoot(() =>
    useRequest(async () => 0, {
      manual: true,
      cacheKey: 'built-nested-mutate',
      cacheProvider: mutateCache
    })
  );
  mutateState = mutateRoot.value;
  mutateArmed = true;
  mutateState.mutate(1);
  if (mutateState.data() !== 2 || mutateCache.get('built-nested-mutate')?.data !== 2) {
    throw new Error('built useRequest let a stale mutate overwrite cache');
  }
  mutateRoot.dispose();

  let cacheState;
  let nestedRequest;
  let cacheArmed = false;
  const successValues = [];
  class ReentrantCache extends Map {
    set(key, value) {
      super.set(key, value);
      if (cacheArmed) {
        cacheArmed = false;
        nestedRequest = cacheState.runAsync('inner');
      }
      return this;
    }
  }
  const cacheProvider = new ReentrantCache();
  updateSignal = () => {};
  const cacheRoot = createCompiledRoot(() =>
    useRequest(async (value) => value, {
      manual: true,
      cacheKey: 'built-cache-reentry',
      cacheProvider,
      onSuccess(value) {
        successValues.push(value);
      }
    })
  );
  cacheState = cacheRoot.value;
  cacheArmed = true;
  await cacheState.runAsync('outer');
  await nestedRequest;
  if (
    successValues.length !== 1 ||
    successValues[0] !== 'inner' ||
    cacheState.data() !== 'inner' ||
    cacheProvider.get('built-cache-reentry')?.data !== 'inner'
  ) {
    throw new Error('built useRequest committed stale cache success work');
  }
  cacheRoot.dispose();
} finally {
  globalThis.__FICT_DEVTOOLS_HOOK__ = previousHook;
}
