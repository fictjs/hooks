import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimeoutFn } from '../../src/timing/useTimeoutFn';

describe('useTimeoutFn', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears a zero-valued timeout handle', () => {
    const clearTimeoutMock = vi.fn();
    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => 0)
    );
    vi.stubGlobal('clearTimeout', clearTimeoutMock);

    const { value: controls } = createRoot(() => useTimeoutFn(vi.fn(), 100));
    controls.cancel();

    expect(clearTimeoutMock).toHaveBeenCalledOnce();
    expect(clearTimeoutMock).toHaveBeenCalledWith(0);
    expect(controls.pending()).toBe(false);
  });

  it('rolls back pending state when scheduling fails', () => {
    const scheduleError = new Error('schedule failed');
    const setTimeoutMock = vi
      .fn<() => number>()
      .mockReturnValueOnce(1)
      .mockImplementationOnce(() => {
        throw scheduleError;
      })
      .mockReturnValue(2);
    vi.stubGlobal('setTimeout', setTimeoutMock);
    vi.stubGlobal('clearTimeout', vi.fn());
    const callback = vi.fn();
    const controls = createRoot(() => useTimeoutFn(callback, 100)).value;

    expect(() => controls.run()).toThrow(scheduleError);
    expect(controls.pending()).toBe(false);
    controls.flush();
    expect(callback).not.toHaveBeenCalled();

    controls.run();
    expect(controls.pending()).toBe(true);
  });

  it('invalidates the callback before a failing cleanup', () => {
    const cleanupError = new Error('cleanup failed');
    let scheduled: (() => void) | undefined;
    vi.stubGlobal(
      'setTimeout',
      vi.fn((callback: () => void) => {
        scheduled = callback;
        return 1;
      })
    );
    vi.stubGlobal(
      'clearTimeout',
      vi.fn(() => {
        throw cleanupError;
      })
    );
    const callback = vi.fn();
    const controls = createRoot(() => useTimeoutFn(callback, 100)).value;

    expect(() => controls.cancel()).toThrow(cleanupError);
    expect(controls.pending()).toBe(false);
    scheduled?.();
    expect(callback).not.toHaveBeenCalled();
  });

  it('preserves a run made synchronously while clearing the previous timeout', () => {
    let timerId = 0;
    const scheduled = new Map<number, () => void>();
    let reenter = false;
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      const id = ++timerId;
      scheduled.set(id, callback);
      return id;
    });
    const controls = createRoot(() => useTimeoutFn(vi.fn(), 100)).value;
    vi.stubGlobal('clearTimeout', (id: number) => {
      scheduled.delete(id);
      if (reenter) {
        reenter = false;
        controls.run();
      }
    });

    reenter = true;
    controls.run();
    expect(scheduled.size).toBe(1);

    controls.cancel();
    expect(scheduled.size).toBe(0);
  });

  it('preserves a run made synchronously by the delay accessor', () => {
    let timerId = 0;
    const scheduled = new Map<number, () => void>();
    let reenter = false;
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      const id = ++timerId;
      scheduled.set(id, callback);
      return id;
    });
    vi.stubGlobal('clearTimeout', (id: number) => scheduled.delete(id));
    const controls = createRoot(() =>
      useTimeoutFn(vi.fn(), () => {
        if (reenter) {
          reenter = false;
          controls.run();
        }
        return 100;
      })
    ).value;

    reenter = true;
    controls.run();
    expect(scheduled.size).toBe(1);

    controls.cancel();
    expect(scheduled.size).toBe(0);
  });

  it('honors cancellation from a synchronous pending notification', () => {
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    let timerId = 0;
    const scheduled = new Map<number, () => void>();
    let controls: ReturnType<typeof useTimeoutFn>;
    let cancelOnPending = false;
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      const id = ++timerId;
      scheduled.set(id, callback);
      return id;
    });
    vi.stubGlobal('clearTimeout', (id: number) => scheduled.delete(id));
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (cancelOnPending && value === true) {
          cancelOnPending = false;
          controls.cancel();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      controls = createRoot(() => useTimeoutFn(vi.fn(), 100)).value;
      controls.cancel();
      cancelOnPending = true;
      controls.run();

      expect(controls.pending()).toBe(false);
      expect(scheduled.size).toBe(0);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('runs callback after delay', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    createRoot(() => {
      useTimeoutFn(callback, 100);
    });

    vi.advanceTimersByTime(99);
    expect(callback).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('supports cancel and run controls', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useTimeoutFn(callback, 100));

    controls.cancel();
    vi.advanceTimersByTime(150);
    expect(callback).toHaveBeenCalledTimes(0);

    controls.run();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('flushes pending timer immediately', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useTimeoutFn(callback, 100));

    controls.flush();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(controls.pending()).toBe(false);
  });

  it('cancels on root dispose', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { dispose } = createRoot(() => {
      useTimeoutFn(callback, 100);
    });

    dispose();
    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('does not run or flush after owner disposal', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const root = createRoot(() => useTimeoutFn(callback, 100));

    root.dispose();
    root.value.run();
    root.value.flush();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
    expect(root.value.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops running when delay resolution disposes the owner', () => {
    vi.useFakeTimers();
    let dispose = () => {};
    let disposeOnRead = false;
    const callback = vi.fn();
    const root = createRoot(() =>
      useTimeoutFn(callback, () => {
        if (disposeOnRead) {
          dispose();
        }
        return 100;
      })
    );
    dispose = root.dispose;
    disposeOnRead = true;

    root.value.run();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
    expect(root.value.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
