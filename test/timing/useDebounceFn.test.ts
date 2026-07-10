import { createRoot } from '@fictjs/runtime';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebounceFn } from '../../src/timing/useDebounceFn';

describe('useDebounceFn', () => {
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
    const controls = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    ).value;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('first');
    expect(controls.pending()).toBe(true);
    expect(clearTimeoutMock).toHaveBeenCalledWith(0);

    scheduled?.();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('does not duplicate leading calls when the timer fires synchronously', () => {
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal('clearTimeout', vi.fn());
    const callback = vi.fn();
    const controls = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    ).value;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'first');
    expect(callback).toHaveBeenNthCalledWith(2, 'second');
    expect(controls.pending()).toBe(false);
  });

  it('rolls back pending state when scheduling fails', () => {
    const scheduleError = new Error('schedule failed');
    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => {
        throw scheduleError;
      })
    );
    vi.stubGlobal('clearTimeout', vi.fn());
    const callback = vi.fn();
    const controls = createRoot(() => useDebounceFn(callback, 100)).value;

    expect(() => controls.run('failed')).toThrow(scheduleError);
    expect(controls.pending()).toBe(false);
    controls.flush();
    expect(callback).not.toHaveBeenCalled();

    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => 1)
    );
    controls.run('recovered');
    controls.flush();
    expect(callback).toHaveBeenCalledWith('recovered');
  });

  it('finalizes all timer state when cleanup fails', () => {
    const cleanupError = new Error('cleanup failed');
    let timerId = 0;
    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => ++timerId)
    );
    const clearTimeoutMock = vi.fn(() => {
      throw cleanupError;
    });
    vi.stubGlobal('clearTimeout', clearTimeoutMock);
    const controls = createRoot(() => useDebounceFn(vi.fn(), 100, { maxWait: 200 })).value;

    controls.run('value');
    expect(() => controls.cancel()).toThrow(cleanupError);

    expect(clearTimeoutMock).toHaveBeenCalledTimes(2);
    expect(clearTimeoutMock).toHaveBeenNthCalledWith(1, 1);
    expect(clearTimeoutMock).toHaveBeenNthCalledWith(2, 2);
    expect(controls.pending()).toBe(false);

    vi.stubGlobal('clearTimeout', vi.fn());
    expect(() => controls.run('recovered')).not.toThrow();
  });

  it('ignores an old callback after cleanup fails and a new call is scheduled', () => {
    const cleanupError = new Error('cleanup failed');
    let timerId = 0;
    const scheduled = new Map<number, () => void>();
    vi.stubGlobal(
      'setTimeout',
      vi.fn((callback: () => void) => {
        const id = ++timerId;
        scheduled.set(id, callback);
        return id;
      })
    );
    vi.stubGlobal(
      'clearTimeout',
      vi.fn(() => {
        throw cleanupError;
      })
    );
    const callback = vi.fn();
    const controls = createRoot(() => useDebounceFn(callback, 100)).value;

    controls.run('old');
    expect(() => controls.cancel()).toThrow(cleanupError);
    controls.run('new');

    scheduled.get(1)!();
    expect(callback).not.toHaveBeenCalled();
    expect(controls.pending()).toBe(true);

    scheduled.get(2)!();
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('new');
    expect(controls.pending()).toBe(false);
  });

  it('does not schedule or flush after owner disposal', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const root = createRoot(() => useDebounceFn(callback, 100));

    root.dispose();
    root.value.run('late');
    root.value.flush();
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
    expect(root.value.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears a handle returned after scheduling disposes the owner', () => {
    let dispose = () => {};
    const clearTimeoutMock = vi.fn();
    vi.stubGlobal('clearTimeout', clearTimeoutMock);
    vi.stubGlobal(
      'setTimeout',
      vi.fn(() => {
        dispose();
        return 7;
      })
    );
    const callback = vi.fn();
    const root = createRoot(() => useDebounceFn(callback, 100));
    dispose = root.dispose;

    root.value.run('late');

    expect(root.value.pending()).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(clearTimeoutMock).toHaveBeenCalledWith(7);
  });

  it('debounces trailing calls by default', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useDebounceFn(callback, 100));

    controls.run('a');
    controls.run('b');
    controls.run('c');

    vi.advanceTimersByTime(99);
    expect(callback).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('c');
  });

  it('supports leading mode', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: false })
    );

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  it('resets leading state when the callback throws', () => {
    vi.useFakeTimers();
    const callbackError = new Error('leading failed');
    const callback = vi
      .fn<(value: string) => void>()
      .mockImplementationOnce(() => {
        throw callbackError;
      })
      .mockImplementation(() => {});
    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    );

    expect(() => controls.run('first')).toThrow(callbackError);
    expect(controls.pending()).toBe(false);

    controls.flush();
    expect(callback).toHaveBeenCalledTimes(1);

    controls.run('second');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('queues reentrant calls made by the leading callback', () => {
    vi.useFakeTimers();
    const controlsRef = {
      current: undefined as ReturnType<typeof useDebounceFn<(value: string) => void>> | undefined
    };
    const callback = vi.fn((value: string) => {
      if (value === 'outer') {
        controlsRef.current!.run('inner');
      }
    });

    const controls = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    ).value;
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
      current: undefined as ReturnType<typeof useDebounceFn<(value: string) => void>> | undefined
    };
    const callback = vi.fn<(value: string) => void>(() => {
      controlsRef.current!.cancel();
    });

    const controls = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    ).value;
    controlsRef.current = controls;

    controls.run('first');
    controls.run('second');

    expect(callback).toHaveBeenCalledTimes(2);
    expect(controls.pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not run trailing callback for a single leading call', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    );

    controls.run('first');
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('first');
  });

  it('runs trailing callback after repeated leading calls', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    );

    controls.run('first');
    vi.advanceTimersByTime(50);
    controls.run('second');
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'first');
    expect(callback).toHaveBeenNthCalledWith(2, 'second');
  });

  it('does not flush a single leading call twice', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { leading: true, trailing: true })
    );

    controls.run('first');
    controls.flush();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('first');
  });

  it('supports cancel and flush', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useDebounceFn(callback, 100));

    controls.run('x');
    expect(controls.pending()).toBe(true);
    controls.cancel();
    expect(controls.pending()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(0);

    controls.run('y');
    expect(controls.pending()).toBe(true);
    controls.flush();
    expect(controls.pending()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('y');
  });

  it('supports maxWait', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useDebounceFn(callback, 100, { maxWait: 250 }));

    controls.run(1);
    vi.advanceTimersByTime(90);
    controls.run(2);
    vi.advanceTimersByTime(90);
    controls.run(3);

    vi.advanceTimersByTime(70);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(3);
  });

  it('does not run maxWait before wait', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() => useDebounceFn(callback, 100, { maxWait: 50 }));

    controls.run('value');
    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('value');
  });

  it('does not run maxWait when trailing is disabled', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { value: controls } = createRoot(() =>
      useDebounceFn(callback, 100, { trailing: false, maxWait: 50 })
    );

    controls.run('value');
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('does not retain or flush calls when trailing is disabled', () => {
    vi.useFakeTimers();
    const leadingCallback = vi.fn();
    const disabledCallback = vi.fn();
    const leading = createRoot(() =>
      useDebounceFn(leadingCallback, 100, { leading: true, trailing: false })
    ).value;
    const disabled = createRoot(() =>
      useDebounceFn(disabledCallback, 100, { leading: false, trailing: false })
    ).value;

    leading.run('first');
    leading.run('suppressed');
    disabled.run('suppressed');

    expect(leading.pending()).toBe(false);
    expect(disabled.pending()).toBe(false);

    leading.flush();
    disabled.flush();

    expect(leadingCallback).toHaveBeenCalledTimes(1);
    expect(leadingCallback).toHaveBeenLastCalledWith('first');
    expect(disabledCallback).not.toHaveBeenCalled();
  });

  it('releases suppressed arguments when trailing is disabled', () => {
    const fixture = resolve('test/fixtures/debounce-argument-release.mjs');

    expect(() =>
      execFileSync(process.execPath, ['--expose-gc', fixture], {
        stdio: 'pipe'
      })
    ).not.toThrow();
  });
});
