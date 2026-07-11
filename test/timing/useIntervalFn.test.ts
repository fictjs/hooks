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

  it('rolls back pending state when scheduling fails', () => {
    const scheduleError = new Error('schedule failed');
    const setIntervalMock = vi
      .fn<() => number>()
      .mockReturnValueOnce(1)
      .mockImplementationOnce(() => {
        throw scheduleError;
      })
      .mockReturnValue(2);
    vi.stubGlobal('setInterval', setIntervalMock);
    vi.stubGlobal('clearInterval', vi.fn());
    const controls = createRoot(() => useIntervalFn(vi.fn(), 100)).value;

    expect(() => controls.run()).toThrow(scheduleError);
    expect(controls.pending()).toBe(false);

    controls.run();
    expect(controls.pending()).toBe(true);
  });

  it('invalidates the callback before a failing cleanup', () => {
    const cleanupError = new Error('cleanup failed');
    let scheduled: (() => void) | undefined;
    vi.stubGlobal(
      'setInterval',
      vi.fn((callback: () => void) => {
        scheduled = callback;
        return 1;
      })
    );
    vi.stubGlobal(
      'clearInterval',
      vi.fn(() => {
        throw cleanupError;
      })
    );
    const callback = vi.fn();
    const controls = createRoot(() => useIntervalFn(callback, 100)).value;

    expect(() => controls.cancel()).toThrow(cleanupError);
    expect(controls.pending()).toBe(false);
    scheduled?.();
    expect(callback).not.toHaveBeenCalled();
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

  it('does not run or flush after owner disposal', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const root = createRoot(() => useIntervalFn(callback, 100));

    root.dispose();
    root.value.run();
    root.value.flush();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
    expect(root.value.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
