import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useVirtualList } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useVirtualList([1, 2, 3], {
      itemHeight: 10,
      containerHeight: 20
    })
  );
} finally {
  __fictPopContext();
}
const element = {
  get scrollTop() {
    root.value.setScrollTop(20);
    return 10;
  }
};
root.value.onScroll({ target: element });

if (root.value.scrollTop() !== 20) {
  throw new Error('built virtual list overwrote a nested scroll update');
}
root.dispose();
