import { createRoot } from '@fictjs/runtime';
import { __fictPopContext, __fictPushContext } from '@fictjs/runtime/internal';
import { useWindowSize } from '../../dist/index.js';

__fictPushContext();
let root;
try {
  root = createRoot(() => useWindowSize({ window: null, initialWidth: 320, initialHeight: 240 }));
} finally {
  __fictPopContext();
}

if (root.value.width() !== 320 || root.value.height() !== 240) {
  throw new Error('built useWindowSize did not preserve its fallback dimensions');
}

root.dispose();
