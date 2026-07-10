import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const stateRef = { current: undefined };
let reenter = false;
const entry = Object.defineProperty(
  { data: 0, timestamp: Date.now(), expiresAt: Infinity },
  'expiresAt',
  {
    enumerable: true,
    get() {
      if (reenter) {
        reenter = false;
        stateRef.current.mutate(2);
        return 0;
      }
      return Infinity;
    }
  }
);
const cacheProvider = new Map([['built-expiry-getter-reentry', entry]]);

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useRequest(async () => 0, {
      manual: true,
      cacheKey: 'built-expiry-getter-reentry',
      cacheProvider
    })
  );
} finally {
  __fictPopContext();
}

stateRef.current = root.value;
reenter = true;
root.value.mutate(1);

if (root.value.data() !== 2 || cacheProvider.get('built-expiry-getter-reentry')?.data !== 2) {
  throw new Error('built useRequest pruned cache owned by a nested mutate');
}
root.dispose();
