import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useFocusWithin, useHover } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class MockElement extends globalThis.EventTarget {
  contains() {
    return false;
  }
}

function createHook(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

const firstFocusTarget = new MockElement();
const secondFocusTarget = new MockElement();
let disposeFocusRefresh = () => {};
let disposeOnFocusTargetRead = false;
const focusRefreshRoot = createHook(() =>
  useFocusWithin(() => {
    if (disposeOnFocusTargetRead) {
      disposeFocusRefresh();
      return secondFocusTarget;
    }
    return firstFocusTarget;
  })
);
disposeFocusRefresh = focusRefreshRoot.dispose;
firstFocusTarget.dispatchEvent(new globalThis.Event('focusin'));
disposeOnFocusTargetRead = true;
focusRefreshRoot.value.refresh();
if (!focusRefreshRoot.value.focused()) {
  throw new Error('built useFocusWithin reset state after target getter disposal');
}

const focusEventTarget = new MockElement();
let disposeFocusEvent = () => {};
const focusEventRoot = createHook(() => useFocusWithin(focusEventTarget));
disposeFocusEvent = focusEventRoot.dispose;
focusEventTarget.dispatchEvent(new globalThis.Event('focusin'));
const focusOut = new globalThis.Event('focusout');
Object.defineProperty(focusOut, 'relatedTarget', {
  configurable: true,
  get() {
    disposeFocusEvent();
    return new globalThis.EventTarget();
  }
});
focusEventTarget.dispatchEvent(focusOut);
if (!focusEventRoot.value.focused()) {
  throw new Error('built useFocusWithin updated state after event getter disposal');
}

const firstHoverTarget = new MockElement();
const secondHoverTarget = new MockElement();
let disposeHoverRefresh = () => {};
let disposeOnHoverTargetRead = false;
const hoverRoot = createHook(() =>
  useHover(() => {
    if (disposeOnHoverTargetRead) {
      disposeHoverRefresh();
      return secondHoverTarget;
    }
    return firstHoverTarget;
  })
);
disposeHoverRefresh = hoverRoot.dispose;
firstHoverTarget.dispatchEvent(new globalThis.Event('pointerenter'));
disposeOnHoverTargetRead = true;
hoverRoot.value.refresh();
if (!hoverRoot.value.hovered()) {
  throw new Error('built useHover reset state after target getter disposal');
}
