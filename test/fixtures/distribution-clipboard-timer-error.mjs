import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useClipboard } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

let parentNode = null;
const textarea = {
  value: '',
  style: {},
  setAttribute() {},
  select() {},
  remove() {
    parentNode = null;
  },
  get parentNode() {
    return parentNode;
  }
};
const body = {
  appendChild(node) {
    parentNode = body;
    return node;
  },
  removeChild(node) {
    parentNode = null;
    return node;
  }
};
const documentRef = {
  body,
  createElement() {
    return textarea;
  },
  execCommand() {
    return true;
  }
};
const windowRef = {
  setTimeout() {
    throw new Error('timer registration failed');
  },
  clearTimeout() {}
};

__fictPushContext();
let root;
try {
  root = createRoot(() =>
    useClipboard({ navigator: null, document: documentRef, window: windowRef })
  );
} finally {
  __fictPopContext();
}

const result = await root.value.copy('fallback');
if (!result || root.value.copied() || parentNode !== null) {
  throw new Error('built useClipboard lost a successful copy after timer registration failed');
}
root.dispose();
