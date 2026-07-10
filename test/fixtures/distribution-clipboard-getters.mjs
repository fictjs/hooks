import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClipboard } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

let dispose = () => {};
let disposeOnRead = false;
let backendWrites = 0;
const disposeNavigator = {
  get clipboard() {
    if (disposeOnRead) dispose();
    return {
      async writeText() {
        backendWrites += 1;
      }
    };
  }
};
const disposeRoot = createCompiledRoot(() =>
  useClipboard({ navigator: disposeNavigator, window: null, document: null })
);
dispose = disposeRoot.dispose;
disposeOnRead = true;
const disposeResult = await disposeRoot.value.copy('terminal-backend');
if (disposeResult || backendWrites !== 0) {
  throw new Error('built clipboard invoked a backend after getter disposal');
}

const writes = [];
let controls;
let reenter = false;
let nestedCopy;
const clipboard = {
  get writeText() {
    if (reenter) {
      reenter = false;
      nestedCopy = controls.copy('nested-copy');
    }
    return async (value) => {
      writes.push(value);
    };
  }
};
const nestedRoot = createCompiledRoot(() => {
  controls = useClipboard({ navigator: { clipboard }, window: null, document: null });
  return controls;
});
reenter = true;
const outerResult = await nestedRoot.value.copy('outer-copy');
const nestedResult = await nestedCopy;
if (outerResult || !nestedResult || writes.join(',') !== 'nested-copy') {
  throw new Error('built clipboard invoked a stale backend after nested copy');
}
nestedRoot.dispose();

let fallbackCreates = 0;
let fallbackExecs = 0;
let fallbackDispose = () => {};
let disposeOnBody = false;
const body = { appendChild() {} };
const fallbackDocument = {
  get body() {
    if (disposeOnBody) fallbackDispose();
    return body;
  },
  createElement() {
    fallbackCreates += 1;
    return {};
  },
  execCommand() {
    fallbackExecs += 1;
    return true;
  }
};
const fallbackRoot = createCompiledRoot(() =>
  useClipboard({ navigator: null, window: null, document: fallbackDocument })
);
fallbackDispose = fallbackRoot.dispose;
disposeOnBody = true;
const fallbackResult = await fallbackRoot.value.copy('terminal-fallback');
if (fallbackResult || fallbackCreates !== 0 || fallbackExecs !== 0) {
  throw new Error('built clipboard continued fallback work after getter disposal');
}
