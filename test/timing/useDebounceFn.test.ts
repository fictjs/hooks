import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebounceFn } from '../../src/timing/useDebounceFn';

describe('useDebounceFn', () => {
  afterEach(() => {
    vi.useRealTimers();
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
    controls.cancel();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(0);

    controls.run('y');
    controls.flush();
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
});
