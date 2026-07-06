import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useThrottleFn } from '../../src/timing/useThrottleFn';

describe('useThrottleFn', () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
