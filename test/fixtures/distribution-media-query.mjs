import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useMediaQuery } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

let activeListener;
let removed = 0;
const mediaQueryList = {
  matches: true,
  addListener(listener) {
    activeListener = listener;
  },
  removeListener(listener) {
    if (listener === activeListener) {
      removed += 1;
    }
  }
};

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useMediaQuery('(prefers-color-scheme: dark)', {
      window: { matchMedia: () => mediaQueryList }
    })
  );
} finally {
  __fictPopContext();
}

if (!root.value.matches()) {
  throw new Error('built useMediaQuery did not read the legacy query result');
}

root.dispose();
if (removed !== 1) {
  throw new Error('built useMediaQuery did not remove its legacy listener');
}
