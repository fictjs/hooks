import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useWindowSize } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

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
