import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useDocumentVisibility } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const documentRef = new EventTarget();
let dispose = () => {};
let disposeOnRead = false;
Object.defineProperty(documentRef, 'visibilityState', {
  configurable: true,
  get() {
    if (disposeOnRead) {
      dispose();
      return 'hidden';
    }
    return 'visible';
  }
});

__fictPushContext();
let root;
try {
  root = createRoot(() => useDocumentVisibility({ document: documentRef }));
} finally {
  __fictPopContext();
}
dispose = root.dispose;
disposeOnRead = true;
documentRef.dispatchEvent(new Event('visibilitychange'));

if (root.value.visibility() !== 'visible' || root.value.hidden()) {
  throw new Error('built useDocumentVisibility committed after getter disposal');
}
