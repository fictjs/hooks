import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useEventListener, useIntersectionObserver, useMutationObserver, useResizeObserver } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class MockElement extends globalThis.EventTarget {}

class MockObserver {
  observe() {}
  disconnect() {}
}

const windowRef = {
  IntersectionObserver: MockObserver,
  MutationObserver: MockObserver,
  ResizeObserver: MockObserver
};

function createHook(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

function verifyTerminalTargetList(name, factory) {
  const first = new MockElement();
  const second = new MockElement();
  let dispose = () => {};
  let disposeOnRead = false;
  let laterReads = 0;
  const targets = [
    () => {
      if (disposeOnRead) {
        dispose();
      }
      return first;
    },
    () => {
      laterReads += 1;
      return second;
    }
  ];
  const root = createHook(() => factory(targets));
  dispose = root.dispose;
  if (laterReads !== 1) {
    throw new Error(`built ${name} did not resolve its initial target list`);
  }
  disposeOnRead = true;

  root.value.refresh();

  if (laterReads !== 1) {
    throw new Error(`built ${name} resolved a later target after disposal`);
  }
}

verifyTerminalTargetList('useEventListener', (targets) =>
  useEventListener(targets, 'terminal-target-list', () => {})
);
verifyTerminalTargetList('useResizeObserver', (targets) =>
  useResizeObserver(targets, undefined, { window: windowRef })
);
verifyTerminalTargetList('useMutationObserver', (targets) =>
  useMutationObserver(targets, undefined, { window: windowRef })
);
verifyTerminalTargetList('useIntersectionObserver', (targets) =>
  useIntersectionObserver(targets, undefined, { window: windowRef })
);
