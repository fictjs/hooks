import { createRoot } from '@fictjs/runtime';
import { __fictPopContext, __fictPushContext } from '@fictjs/runtime/internal';
import { useDocumentVisibility } from '../../dist/index.js';

__fictPushContext();
let root;
try {
  root = createRoot(() => useDocumentVisibility({ document: null, initialVisibility: 'hidden' }));
} finally {
  __fictPopContext();
}

if (root.value.visibility() !== 'hidden' || !root.value.hidden()) {
  throw new Error('built useDocumentVisibility did not preserve its fallback state');
}

root.dispose();
