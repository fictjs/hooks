import { createRoot } from '@fictjs/runtime';
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
});
