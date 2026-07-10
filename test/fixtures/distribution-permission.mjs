import { createRoot } from '@fictjs/runtime';
import { __fictPopContext, __fictPushContext } from '@fictjs/runtime/internal';
import { usePermission } from '../../dist/index.js';

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
