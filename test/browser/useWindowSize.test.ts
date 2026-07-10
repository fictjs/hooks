import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useWindowSize } from '../../src/browser/useWindowSize';

describe('useWindowSize', () => {
  it('reads current window size', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

    const { value: state } = createRoot(() => useWindowSize());

    expect(state.width()).toBe(1024);
    expect(state.height()).toBe(768);
  });

  it('updates on resize event', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    const { value: state } = createRoot(() => useWindowSize());

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    window.dispatchEvent(new Event('resize'));

    expect(state.width()).toBe(1280);
    expect(state.height()).toBe(720);
  });

  it('stops a resize update when its width write disposes the owner', () => {
    const windowTarget = Object.assign(new EventTarget(), {
      innerWidth: 100,
      innerHeight: 200
    });
    const windowRef = windowTarget as unknown as Window;
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === 300) {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useWindowSize({ window: windowRef }));
      dispose = root.dispose;
      windowTarget.innerWidth = 300;
      windowTarget.innerHeight = 400;
      armed = true;

      windowRef.dispatchEvent(new Event('resize'));

      expect(root.value.width()).toBe(300);
      expect(root.value.height()).toBe(200);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('uses initial fallback without window', () => {
    const { value: state } = createRoot(() =>
      useWindowSize({ window: null, initialWidth: 320, initialHeight: 480 })
    );

    expect(state.width()).toBe(320);
    expect(state.height()).toBe(480);
  });
});
