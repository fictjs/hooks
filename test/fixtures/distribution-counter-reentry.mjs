import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useCounter } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

let setNested = () => {};
let reenter = false;
const options = {
  min: 0,
  get max() {
    if (reenter) {
      reenter = false;
      setNested(5);
    }
    return 10;
  }
};

__fictPushContext();
let root;
try {
  root = createRoot(() => useCounter(0, options));
} finally {
  __fictPopContext();
}
setNested = root.value.set;
reenter = true;
root.value.set(7);

if (root.value.count() !== 5) {
  throw new Error('built useCounter overwrote a nested bounds update');
}
root.dispose();
