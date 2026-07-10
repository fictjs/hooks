import { createRoot } from '@fictjs/runtime';
import { __fictPopContext, __fictPushContext } from '@fictjs/runtime/internal';
import { useFullscreen } from '../../dist/index.js';

__fictPushContext();
let root;
try {
  root = createRoot(() => useFullscreen({ document: null }));
} finally {
  __fictPopContext();
}

if (root.value.isSupported() || root.value.isFullscreen()) {
  throw new Error('built useFullscreen reported state without a document');
}

root.dispose();
