import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntervalFn } from '../../src/timing/useIntervalFn';

describe('useIntervalFn', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears a zero-valued interval handle', () => {
    const clearIntervalMock = vi.fn();
    vi.stubGlobal(
      'setInterval',
      vi.fn(() => 0)
    );
    vi.stubGlobal('clearInterval', clearIntervalMock);

    const { value: controls } = createRoot(() => useIntervalFn(vi.fn(), 100));
    controls.cancel();

    expect(clearIntervalMock).toHaveBeenCalledOnce();
    expect(clearIntervalMock).toHaveBeenCalledWith(0);
    expect(controls.pending()).toBe(false);
  });

  it('runs callback on interval', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    createRoot(() => {
      useIntervalFn(callback, 50);
    });

    vi.advanceTimersByTime(149);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('supports cancel and run', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useIntervalFn(callback, 30));

    vi.advanceTimersByTime(60);
    expect(callback).toHaveBeenCalledTimes(2);

    controls.cancel();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(2);

    controls.run();
    vi.advanceTimersByTime(90);
    expect(callback).toHaveBeenCalledTimes(5);
  });

  it('flush runs callback immediately', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useIntervalFn(callback, 100));
    controls.flush();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cleans interval on dispose', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { dispose } = createRoot(() => {
      useIntervalFn(callback, 20);
    });

    dispose();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(0);
  });
});
