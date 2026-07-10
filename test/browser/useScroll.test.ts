import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useScroll } from '../../src/browser/useScroll';

function createDocumentTarget(options: {
  defaultView?: Window | null;
  scrollingElement?: Element | null;
  documentElement?: Element | null;
  body?: HTMLElement | null;
}): Document {
  const target = new EventTarget();
  Object.defineProperties(target, {
    defaultView: { configurable: true, value: options.defaultView ?? null },
    scrollingElement: { configurable: true, value: options.scrollingElement ?? null },
    documentElement: { configurable: true, value: options.documentElement ?? null },
    body: { configurable: true, value: options.body ?? null }
  });
  return target as Document;
}

function createScroller(x: number, y: number): Element {
  return {
    scrollLeft: x,
    scrollTop: y
  } as Element;
}

describe('useScroll', () => {
  it('reads and updates window scroll position', () => {
    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 10 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 20 });

    const { value: state } = createRoot(() => useScroll());
    expect(state.x()).toBe(10);
    expect(state.y()).toBe(20);

    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 40 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 50 });
    window.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(40);
    expect(state.y()).toBe(50);
  });

  it('tracks element scroll target', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 5, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 6, writable: true });

    const { value: state } = createRoot(() => useScroll({ target: element }));
    expect(state.x()).toBe(5);
    expect(state.y()).toBe(6);

    element.scrollLeft = 15;
    element.scrollTop = 16;
    element.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(15);
    expect(state.y()).toBe(16);
  });

  it('reads document scroll from its default view', () => {
    const view = {
      pageXOffset: 11,
      pageYOffset: 12
    } as Window;
    const documentRef = createDocumentTarget({ defaultView: view });

    const { value: state } = createRoot(() => useScroll({ target: documentRef, window: null }));

    expect(state.x()).toBe(11);
    expect(state.y()).toBe(12);
  });

  it('uses the supplied window when a document has no default view', () => {
    const windowRef = {
      pageXOffset: 21,
      pageYOffset: 22
    } as Window;
    const documentRef = createDocumentTarget({ defaultView: null });

    const { value: state } = createRoot(() =>
      useScroll({ target: documentRef, window: windowRef })
    );

    expect(state.x()).toBe(21);
    expect(state.y()).toBe(22);
  });

  it.each([
    ['scrolling element', { scrollingElement: createScroller(31, 32) }, 31, 32],
    ['document element', { documentElement: createScroller(41, 42) }, 41, 42],
    ['body', { body: createScroller(51, 52) as HTMLElement }, 51, 52]
  ] as const)('falls back to the document %s', (_name, documentOptions, expectedX, expectedY) => {
    const documentRef = createDocumentTarget(documentOptions);

    const { value: state } = createRoot(() => useScroll({ target: documentRef, window: null }));

    expect(state.x()).toBe(expectedX);
    expect(state.y()).toBe(expectedY);
  });

  it('reads scrollX and scrollY from window-like targets', () => {
    const windowTarget = new EventTarget() as Window;
    Object.defineProperties(windowTarget, {
      scrollX: { configurable: true, value: 61, writable: true },
      scrollY: { configurable: true, value: 62, writable: true }
    });
    const { value: state } = createRoot(() => useScroll({ target: windowTarget, window: null }));

    expect(state.x()).toBe(61);
    expect(state.y()).toBe(62);

    Object.defineProperties(windowTarget, {
      scrollX: { configurable: true, value: 71 },
      scrollY: { configurable: true, value: 72 }
    });
    windowTarget.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(71);
    expect(state.y()).toBe(72);
  });

  it('reacts to target accessor changes', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    Object.defineProperty(a, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(a, 'scrollTop', { configurable: true, value: 2, writable: true });
    Object.defineProperty(b, 'scrollLeft', { configurable: true, value: 30, writable: true });
    Object.defineProperty(b, 'scrollTop', { configurable: true, value: 40, writable: true });

    const current = createSignal<Element>(a);
    const { value: state } = createRoot(() =>
      useScroll({
        target: () => current()
      })
    );

    expect(state.x()).toBe(1);
    expect(state.y()).toBe(2);

    current(b);
    await Promise.resolve();
    expect(state.x()).toBe(30);
    expect(state.y()).toBe(40);
  });

  it('binds and updates when an accessor target appears later', async () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 81 });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 82 });
    const current = createSignal<Element | undefined>(undefined);
    const root = createRoot(() =>
      useScroll({
        target: () => current(),
        initialX: 1,
        initialY: 2
      })
    );

    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);

    current(element);
    await Promise.resolve();

    expect(root.value.x()).toBe(81);
    expect(root.value.y()).toBe(82);
    root.dispose();
  });

  it('refreshes a non-reactive ref assigned after deferred setup', async () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 91, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 92, writable: true });
    const ref = { current: null as Element | null };
    const root = createRoot(() =>
      useScroll({
        target: ref,
        initialX: 1,
        initialY: 2
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    ref.current = element;
    root.value.refresh();

    expect(root.value.x()).toBe(91);
    expect(root.value.y()).toBe(92);

    element.scrollTop = 93;
    element.dispatchEvent(new Event('scroll'));
    expect(root.value.y()).toBe(93);
    root.dispose();
  });

  it('uses fallback values without target/window', () => {
    const { value: state } = createRoot(() =>
      useScroll({
        target: null,
        window: null,
        initialX: 7,
        initialY: 8
      })
    );

    expect(state.x()).toBe(7);
    expect(state.y()).toBe(8);
  });

  it('supports shouldUpdate guard', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 0, writable: true });

    const { value: state } = createRoot(() =>
      useScroll({
        target: element,
        shouldUpdate(next) {
          return next.y % 2 === 0;
        }
      })
    );

    element.scrollTop = 1;
    element.dispatchEvent(new Event('scroll'));
    expect(state.y()).toBe(0);

    element.scrollTop = 2;
    element.dispatchEvent(new Event('scroll'));
    expect(state.y()).toBe(2);
  });

  it('does not let a stale update overwrite a nested refresh', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 0, writable: true });
    let refresh = () => {};
    let refreshNested = false;
    const controls = createRoot(() =>
      useScroll({
        target: element,
        shouldUpdate(next) {
          if (refreshNested && next.x === 10) {
            refreshNested = false;
            element.scrollLeft = 30;
            element.scrollTop = 40;
            refresh();
          }
          return true;
        }
      })
    ).value;
    refresh = controls.refresh;

    refreshNested = true;
    element.scrollLeft = 10;
    element.scrollTop = 20;
    element.dispatchEvent(new Event('scroll'));

    expect(controls.x()).toBe(30);
    expect(controls.y()).toBe(40);
  });

  it('keeps coordinates coherent when the x write refreshes synchronously', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2, writable: true });
    let refresh = () => {};
    let refreshOnX = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (refreshOnX && value === 10) {
          refreshOnX = false;
          refresh();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useScroll({ target: element }));
      refresh = root.value.refresh;
      element.scrollLeft = 10;
      element.scrollTop = 20;
      refreshOnX = true;

      element.dispatchEvent(new Event('scroll'));

      expect(root.value.x()).toBe(10);
      expect(root.value.y()).toBe(20);
      root.value.refresh();
      expect(root.value.x()).toBe(10);
      expect(root.value.y()).toBe(20);
      root.dispose();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('passes explicit passive and capture options to the listener', () => {
    const element = document.createElement('div');
    const addEventListener = vi.spyOn(element, 'addEventListener');

    createRoot(() =>
      useScroll({
        target: element,
        passive: false,
        capture: true
      })
    );

    expect(addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      expect.objectContaining({ passive: false, capture: true })
    );
  });

  it('does not refresh or update after dispose', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2, writable: true });
    const addEventListener = vi.spyOn(element, 'addEventListener');
    const root = createRoot(() => useScroll({ target: element }));
    const registrations = addEventListener.mock.calls.length;

    root.dispose();
    element.scrollLeft = 10;
    element.scrollTop = 20;
    root.value.refresh();
    element.dispatchEvent(new Event('scroll'));

    expect(addEventListener).toHaveBeenCalledTimes(registrations);
    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('does not update when target resolution disposes the owner', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2, writable: true });
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      useScroll({
        target: () => {
          if (disposeOnRead) {
            dispose();
          }
          return element;
        }
      })
    );
    dispose = root.dispose;

    element.scrollLeft = 10;
    element.scrollTop = 20;
    disposeOnRead = true;
    element.dispatchEvent(new Event('scroll'));

    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('does not rebind when refresh target resolution disposes the owner', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1 });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2 });
    const addEventListener = vi.spyOn(element, 'addEventListener');
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      useScroll({
        target: () => {
          if (disposeOnRead) {
            dispose();
          }
          return element;
        }
      })
    );
    dispose = root.dispose;
    const registrations = addEventListener.mock.calls.length;

    disposeOnRead = true;
    root.value.refresh();

    expect(addEventListener).toHaveBeenCalledTimes(registrations);
    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('does not update after reading scroll coordinates disposes the owner', () => {
    const element = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    Object.defineProperties(element, {
      scrollLeft: {
        configurable: true,
        get() {
          if (disposeOnRead) {
            dispose();
          }
          return disposeOnRead ? 10 : 1;
        }
      },
      scrollTop: { configurable: true, get: () => (disposeOnRead ? 20 : 2) }
    });
    const root = createRoot(() => useScroll({ target: element }));
    dispose = root.dispose;

    disposeOnRead = true;
    element.dispatchEvent(new Event('scroll'));

    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('stops refresh after shouldUpdate disposes the owner', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2, writable: true });
    let dispose = () => {};
    let disposeOnGuard = false;
    const root = createRoot(() =>
      useScroll({
        target: element,
        shouldUpdate() {
          if (disposeOnGuard) {
            dispose();
          }
          return true;
        }
      })
    );
    dispose = root.dispose;

    element.scrollLeft = 10;
    element.scrollTop = 20;
    disposeOnGuard = true;
    root.value.refresh();

    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('stops refresh when its final target read disposes the owner', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1 });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2 });
    let dispose = () => {};
    let reads = 0;
    let disposeAt = Number.POSITIVE_INFINITY;
    const root = createRoot(() =>
      useScroll({
        target: () => {
          reads += 1;
          if (reads === disposeAt) {
            dispose();
          }
          return element;
        }
      })
    );
    dispose = root.dispose;
    reads = 0;
    disposeAt = 3;

    root.value.refresh();

    expect(reads).toBe(3);
    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('rolls back a deferred listener when registration disposes the owner', async () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 10 });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 20 });
    const ref = { current: null as Element | null };
    let dispose = () => {};
    let registrations = 0;
    const addListener = element.addEventListener.bind(element);
    const addEventListener = vi.spyOn(element, 'addEventListener').mockImplementation((...args) => {
      addListener(...args);
      registrations += 1;
      if (registrations === 2) {
        dispose();
      }
    });
    const removeEventListener = vi.spyOn(element, 'removeEventListener');
    const root = createRoot(() => useScroll({ target: ref, initialX: 1, initialY: 2 }));
    dispose = root.dispose;

    ref.current = element;
    await Promise.resolve();

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(2);
    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('stops a deferred update when shouldUpdate disposes the owner', async () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 10 });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 20 });
    const ref = { current: null as Element | null };
    let dispose = () => {};
    let disposeOnGuard = false;
    const root = createRoot(() =>
      useScroll({
        target: ref,
        initialX: 1,
        initialY: 2,
        shouldUpdate() {
          if (disposeOnGuard) {
            dispose();
          }
          return true;
        }
      })
    );
    dispose = root.dispose;

    ref.current = element;
    disposeOnGuard = true;
    await Promise.resolve();

    expect(root.value.x()).toBe(1);
    expect(root.value.y()).toBe(2);
  });

  it('stops coordinate writes when the x signal update disposes the owner', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 2, writable: true });
    let dispose = () => {};
    const updates: unknown[] = [];
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        updates.push(value);
        if (value === 10) {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useScroll({ target: element }));
      dispose = root.dispose;
      updates.length = 0;
      element.scrollLeft = 10;
      element.scrollTop = 20;

      element.dispatchEvent(new Event('scroll'));

      expect(updates).toContain(10);
      expect(updates).not.toContain(20);
      expect(root.value.x()).toBe(10);
      expect(root.value.y()).toBe(2);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });
});
