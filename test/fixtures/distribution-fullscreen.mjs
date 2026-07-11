import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useFullscreen } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

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
