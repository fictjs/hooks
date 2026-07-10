import { loadDistribution } from './load-distribution.mjs';

const { advanced, hooks, internal, runtime } = await loadDistribution();
const { usePrevious } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;
const { createSignal } = advanced;

const source = createSignal(1);
let dispose = () => {};
let disposeOnRead = false;
__fictPushContext();
let root;
try {
  root = createRoot(() =>
    usePrevious(() => {
      const current = source();
      if (disposeOnRead) dispose();
      return current;
    })
  );
} finally {
  __fictPopContext();
}
dispose = root.dispose;
disposeOnRead = true;
source(2);
await Promise.resolve();

if (root.value() !== undefined) {
  throw new Error('built usePrevious committed after source disposal');
}
