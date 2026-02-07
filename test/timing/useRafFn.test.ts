import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useRafFn } from '../../src/timing/useRafFn';

function createMockWindow(): {
  windowRef: Window;
  tick: (timestamp: number) => void;
} {
  let id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();

  const windowRef = {
    requestAnimationFrame(callback: FrameRequestCallback) {
      id += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(handle: number) {
      callbacks.delete(handle);
    }
  } as Window;

  const tick = (timestamp: number) => {
    const current = Array.from(callbacks.entries());
    callbacks.clear();
    for (const [, callback] of current) {
      callback(timestamp);
    }
  };

  return { windowRef, tick };
}

describe('useRafFn', () => {
  it('runs callback on animation frames', () => {
    const { windowRef, tick } = createMockWindow();
    const callback = vi.fn();

    createRoot(() => {
      useRafFn(callback, { window: windowRef });
    });

    tick(10);
    tick(26);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 0, 10);
    expect(callback).toHaveBeenNthCalledWith(2, 16, 26);
  });

  it('supports stop/start controls', () => {
    const { windowRef, tick } = createMockWindow();
    const callback = vi.fn();

    const { value: state } = createRoot(() => useRafFn(callback, { window: windowRef }));

    tick(1);
    state.stop();
    tick(2);

    state.start();
    tick(3);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('can start lazily', () => {
    const { windowRef, tick } = createMockWindow();
    const callback = vi.fn();

    const { value: state } = createRoot(() =>
      useRafFn(callback, { window: windowRef, immediate: false })
    );

    tick(1);
    expect(callback).toHaveBeenCalledTimes(0);

    state.start();
    tick(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
