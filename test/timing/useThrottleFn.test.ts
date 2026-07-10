import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useThrottleFn } from '../../src/timing/useThrottleFn';

describe('useThrottleFn', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('treats a zero-valued timer handle as scheduled', () => {
    let scheduled: (() => void) | undefined;
    const clearTimeoutMock = vi.fn(() => {
      scheduled = undefined;
    });
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      scheduled = callback;
      return 0;
    });
    vi.stubGlobal('clearTimeout', clearTimeoutMock);
    const callback = vi.fn();
    const controls = createRoot(() => useThrottleFn(callback, 100)).value;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('first');
    expect(controls.pending()).toBe(true);

    scheduled?.();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('does not strand trailing state when the timer fires synchronously', () => {
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal('clearTimeout', vi.fn());
    const callback = vi.fn();
    const controls = createRoot(() => useThrottleFn(callback, 100)).value;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'first');
    expect(callback).toHaveBeenNthCalledWith(2, 'second');
    expect(controls.pending()).toBe(false);
  });

  it('rolls back trailing state when scheduling fails', () => {
    const scheduleError = new Error('schedule failed');
    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => {
        throw scheduleError;
      })
    );
    vi.stubGlobal('clearTimeout', vi.fn());
    const callback = vi.fn();
    const controls = createRoot(() =>
      useThrottleFn(callback, 100, { leading: false, trailing: true })
    ).value;

    expect(() => controls.run('failed')).toThrow(scheduleError);
    expect(controls.pending()).toBe(false);
    controls.flush();
    expect(callback).not.toHaveBeenCalled();

    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => 1)
    );
    controls.run('recovered');
    expect(controls.pending()).toBe(true);
  });

  it('drops trailing state before a failing cleanup', () => {
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
    const controls = createRoot(() => useThrottleFn(callback, 100)).value;

    controls.run('leading');
    controls.run('trailing');
    expect(() => controls.cancel()).toThrow(cleanupError);
    expect(controls.pending()).toBe(false);

    scheduled?.();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('leading');
  });

  it('throttles calls with leading and trailing by default', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useThrottleFn(callback, 100));

    controls.run('a');
    controls.run('b');
    controls.run('c');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenNthCalledWith(1, 'a');
    expect(controls.pending()).toBe(true);

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(2, 'c');
    expect(controls.pending()).toBe(false);
  });

  it('supports leading false', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useThrottleFn(callback, 100, { leading: false, trailing: true })
    );

    controls.run('v1');
    expect(callback).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('v1');
  });

  it('queues reentrant calls made by the leading callback', () => {
    vi.useFakeTimers();
    const controlsRef = {
      current: undefined as ReturnType<typeof useThrottleFn<(value: string) => void>> | undefined
    };
    const callback = vi.fn((value: string) => {
      if (value === 'outer') {
        controlsRef.current!.run('inner');
      }
    });

    const controls = createRoot(() => useThrottleFn(callback, 100)).value;
    controlsRef.current = controls;

    controls.run('outer');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('outer');
    expect(controls.pending()).toBe(true);

    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('inner');
  });

  it('honors cancellation from the leading callback', () => {
    vi.useFakeTimers();
    const controlsRef = {
      current: undefined as ReturnType<typeof useThrottleFn<(value: string) => void>> | undefined
    };
    const callback = vi.fn<(value: string) => void>(() => {
      controlsRef.current!.cancel();
    });

    const controls = createRoot(() => useThrottleFn(callback, 100)).value;
    controlsRef.current = controls;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(controls.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers when a leading callback throws', () => {
    vi.useFakeTimers();
    const callbackError = new Error('leading failed');
    const callback = vi
      .fn<(value: string) => void>()
      .mockImplementationOnce(() => {
        throw callbackError;
      })
      .mockImplementation(() => {});
    const { value: controls } = createRoot(() => useThrottleFn(callback, 100));

    expect(() => controls.run('first')).toThrow(callbackError);
    expect(controls.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('supports cancel and flush', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useThrottleFn(callback, 100));

    controls.run('x');
    controls.run('y');
    controls.cancel();
    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('x');

    controls.run('z');
    controls.run('zz');
    expect(controls.pending()).toBe(true);
    controls.flush();
    expect(controls.pending()).toBe(false);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(2, 'z');
    expect(callback).toHaveBeenNthCalledWith(3, 'zz');
  });

  it('preserves throttle window after flush', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useThrottleFn(callback, 100));

    controls.run('a');
    vi.advanceTimersByTime(10);
    controls.run('b');
    controls.flush();
    controls.run('c');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'a');
    expect(callback).toHaveBeenNthCalledWith(2, 'b');

    vi.advanceTimersByTime(90);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(3, 'c');
  });

  it('recovers when a trailing callback throws', () => {
    vi.useFakeTimers();
    const callback = vi.fn((value: string) => {
      if (value === 'throws') {
        throw new Error('boom');
      }
    });

    const { value: controls } = createRoot(() => useThrottleFn(callback, 100));

    controls.run('leading');
    controls.run('throws');

    expect(() => vi.advanceTimersByTime(100)).toThrow('boom');
    expect(controls.pending()).toBe(false);

    controls.run('after-error');
    expect(controls.pending()).toBe(true);
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(3, 'after-error');
    expect(controls.pending()).toBe(false);
  });
});
