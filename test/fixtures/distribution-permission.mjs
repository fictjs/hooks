import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { usePermission } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const status = new globalThis.EventTarget();
status.name = 'camera';
status.state = 'granted';

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    usePermission(
      { name: 'camera' },
      {
        navigator: {
          permissions: {
            query: async () => status
          }
        },
        immediate: false
      }
    )
  );
} finally {
  __fictPopContext();
}

const result = await root.value.query();
if (result !== status || root.value.state() !== 'granted') {
  throw new Error('built usePermission did not bind the queried status');
}

root.dispose();
