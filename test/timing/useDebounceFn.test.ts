import { createRoot } from '@fictjs/runtime';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
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
