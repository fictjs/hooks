import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useDocumentVisibility } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

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
