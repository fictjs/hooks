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
});
