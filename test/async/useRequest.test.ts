import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRequest } from '../../src/async/useRequest';

describe('useRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto runs with default params', async () => {
    const service = vi.fn(async (value: number) => value + 1);

    const { value: state } = createRoot(() =>
      useRequest(service, {
        defaultParams: [1]
      })
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(service).toHaveBeenCalledWith(1);
    expect(state.data()).toBe(2);
  });

  it('supports manual run and mutate', async () => {
    const service = vi.fn(async (name: string) => `hello ${name}`);

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true
      })
    );

    expect(service).toHaveBeenCalledTimes(0);

    await state.runAsync('fict');
    expect(state.data()).toBe('hello fict');

    state.mutate('manual');
    expect(state.data()).toBe('manual');
  });

  it('retries failed requests', async () => {
    const service = vi
      .fn<(...args: [number]) => Promise<number>>()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValue(5);

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        retryCount: 2,
        retryInterval: 1
      })
    );

    await state.runAsync(1);

    expect(service).toHaveBeenCalledTimes(3);
    expect(state.data()).toBe(5);
  });

  it('reuses cached data by cacheKey', async () => {
    const service = vi.fn(async () => 42);

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-demo'
      })
    ).value;

    await first.runAsync();
    expect(first.data()).toBe(42);

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-demo'
      })
    ).value;

    expect(second.data()).toBe(42);
  });

  it('runs success/error/finally callbacks with latest params', async () => {
    const success = vi.fn();
    const failure = vi.fn();
    const done = vi.fn();
    const service = vi
      .fn<(...args: [number]) => Promise<number>>()
      .mockResolvedValueOnce(10)
      .mockRejectedValueOnce(new Error('boom'));

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        onSuccess: success,
        onError: failure,
        onFinally: done
      })
    );

    await state.runAsync(1);
    expect(success).toHaveBeenCalledWith(10, [1]);
    expect(done).toHaveBeenCalledWith([1], 10, null);

    await state.runAsync(2);
    expect(failure).toHaveBeenCalled();
    const [, failedParams] = failure.mock.calls.at(-1)!;
    expect(failedParams).toEqual([2]);
    expect((state.error() as Error).message).toBe('boom');
  });

  it('refreshes with latest params', async () => {
    const service = vi.fn(async (name: string) => `hello ${name}`);

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true
      })
    );

    await state.runAsync('fict');
    await state.refresh();

    expect(service).toHaveBeenCalledTimes(2);
    expect(service).toHaveBeenNthCalledWith(2, 'fict');
  });

  it('ignores stale responses after cancel', async () => {
    let resolveLater: ((value: number) => void) | undefined;
    const service = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveLater = resolve;
        })
    );

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true
      })
    );

    const pending = state.runAsync();
    state.cancel();
    resolveLater!(123);
    await pending;

    expect(state.data()).toBeUndefined();
    expect(state.loading()).toBe(false);
  });

  it('polls repeatedly and stops polling on dispose', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 'ok');

    const { value: state, dispose } = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20
      })
    );

    await state.runAsync();
    expect(service).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    expect(service).toHaveBeenCalledTimes(2);

    dispose();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    expect(service).toHaveBeenCalledTimes(2);
  });

  it('evicts stale cache entries', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 9);

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'stale-cache-key',
        staleTime: 5
      })
    ).value;

    await first.runAsync();
    expect(first.data()).toBe(9);

    await vi.advanceTimersByTimeAsync(10);

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'stale-cache-key',
        staleTime: 5
      })
    ).value;

    expect(second.data()).toBeUndefined();
  });
});
