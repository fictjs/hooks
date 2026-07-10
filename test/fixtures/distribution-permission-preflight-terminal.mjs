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
  const status = new globalThis.EventTarget();
  status.name = 'camera';
  status.state = 'granted';
  let queryCalls = 0;
  let current = 'camera';
  let dispose = () => {};
  let disposeOnRead = false;
  const root = createCompiledRoot(() =>
    usePermission(
      () => {
        if (disposeOnRead) dispose();
        return current;
      },
      {
        navigator: {
          permissions: {
            async query() {
              queryCalls += 1;
              return status;
            }
          }
        },
        immediate: false
      }
    )
  );
  dispose = root.dispose;
  await root.value.query();
  current = 'microphone';
  disposeOnRead = true;

  const result = await root.value.query();
  if (result !== null || root.value.state() !== 'granted' || queryCalls !== 1) {
    throw new Error('built usePermission reset state after accessor disposal');
  }
}

{
  let queryCalls = 0;
  let dispose = () => {};
  let disposeOnQueryRead = false;
  const query = async () => {
    queryCalls += 1;
    return null;
  };
  const permissions = Object.defineProperty({}, 'query', {
    get() {
      if (disposeOnQueryRead) dispose();
      return query;
    }
  });
  const root = createCompiledRoot(() =>
    usePermission('camera', {
      navigator: { permissions },
      immediate: false
    })
  );
  dispose = root.dispose;
  disposeOnQueryRead = true;

  const result = await root.value.query();
  if (result !== null || queryCalls !== 0 || root.value.state() !== 'prompt') {
    throw new Error('built usePermission called query after getter disposal');
  }
}
