import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useRequest } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

const calls = [];
let state;
let nestedRefresh;
let phase = 'setup';
const options = Object.defineProperty({ manual: true }, 'defaultParams', {
  enumerable: true,
  get() {
    if (phase === 'setup') {
      return undefined;
    }
    if (phase === 'outer') {
      phase = 'inner';
      nestedRefresh = state.refresh();
      return ['outer'];
    }
    return ['inner'];
  }
});

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useRequest(async (value) => {
      calls.push(value);
      return value;
    }, options)
  );
} finally {
  __fictPopContext();
}

state = root.value;
phase = 'outer';
await state.refresh();
await nestedRefresh;

if (
  calls.length !== 1 ||
  calls[0] !== 'inner' ||
  state.data() !== 'inner' ||
  state.params()?.[0] !== 'inner'
) {
  throw new Error('built useRequest overwrote a nested refresh');
}
root.dispose();
