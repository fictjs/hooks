import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRequestCache, useRequest } from '../../src/async/useRequest';

describe('useRequest', () => {
  afterEach(() => {
    clearRequestCache();
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

  it('auto runs with empty params by default', async () => {
    const service = vi.fn(async () => 'ok');

    const { value: state } = createRoot(() => useRequest(service));

    await Promise.resolve();
    await Promise.resolve();

    expect(service).toHaveBeenCalledTimes(1);
    expect(service).toHaveBeenCalledWith();
    expect(state.data()).toBe('ok');
    expect(state.params()).toEqual([]);
  });

  it('keeps auto-run result when created outside a root', async () => {
    const service = vi.fn(async (value: number) => value + 1);

    const state = useRequest(service, {
      defaultParams: [1]
    });

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

  it('does not mutate state or cache after dispose', () => {
    const cacheProvider = new Map();
    const root = createRoot(() =>
      useRequest(async () => 1, {
        manual: true,
        cacheKey: 'disposed-mutate',
        cacheProvider
      })
    );

    root.dispose();
    root.value.mutate(2);

    expect(root.value.data()).toBeUndefined();
    expect(cacheProvider.has('disposed-mutate')).toBe(false);
  });

  it('does not commit a mutate updater that disposes the root', () => {
    const cacheProvider = new Map();
    const root = createRoot(() =>
      useRequest(async () => 1, {
        manual: true,
        cacheKey: 'reentrant-disposed-mutate',
        cacheProvider
      })
    );
    root.value.mutate(1);

    root.value.mutate(() => {
      root.dispose();
      return 2;
    });

    expect(root.value.data()).toBe(1);
    expect(cacheProvider.get('reentrant-disposed-mutate')?.data).toBe(1);
  });

  it('does not cache or call onSuccess when the data signal update disposes the root', async () => {
    const cacheProvider = new Map();
    const service = vi.fn(async () => 42);
    const onSuccess = vi.fn();
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === 42) {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useRequest(service, {
          manual: true,
          cacheKey: 'disposed-success',
          cacheProvider,
          onSuccess
        })
      );
      dispose = root.dispose;
      armed = true;

      await expect(root.value.runAsync()).resolves.toBe(42);

      expect(root.value.data()).toBe(42);
      expect(root.value.loading()).toBe(false);
      expect(cacheProvider.has('disposed-success')).toBe(false);
      expect(onSuccess).not.toHaveBeenCalled();

      await expect(root.value.runAsync()).resolves.toBe(42);
      expect(service).toHaveBeenCalledTimes(1);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not call onError when the error signal update disposes the root', async () => {
    const requestError = new Error('request failed');
    const onError = vi.fn();
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === requestError) {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useRequest(
          async () => {
            throw requestError;
          },
          { manual: true, onError }
        )
      );
      dispose = root.dispose;
      armed = true;

      await expect(root.value.runAsync()).resolves.toBeUndefined();

      expect(root.value.error()).toBe(requestError);
      expect(root.value.loading()).toBe(false);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not call onFinally when the loading completion disposes the root', async () => {
    const onFinally = vi.fn();
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === false) {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useRequest(async () => 1, { manual: true, onFinally }));
      dispose = root.dispose;
      armed = true;

      await expect(root.value.runAsync()).resolves.toBe(1);

      expect(root.value.data()).toBe(1);
      expect(root.value.loading()).toBe(false);
      expect(onFinally).not.toHaveBeenCalled();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not overwrite nested run params after a loading signal notification', async () => {
    let state: ReturnType<typeof useRequest<string, [string]>>;
    let nested: Promise<string | undefined> | undefined;
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === true) {
          armed = false;
          nested = state.runAsync('inner');
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      state = createRoot(() =>
        useRequest(async (value: string) => value, { manual: true })
      ).value;
      armed = true;

      await state.runAsync('outer');
      await nested;

      expect(state.params()).toEqual(['inner']);
      expect(state.data()).toBe('inner');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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

  it('clears cached data by cacheKey', async () => {
    const service = vi.fn(async () => 42);

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'clear-cache-demo'
      })
    ).value;

    await first.runAsync();
    clearRequestCache('clear-cache-demo');

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'clear-cache-demo'
      })
    ).value;

    expect(second.data()).toBeUndefined();
  });

  it('supports per-instance cache providers', async () => {
    const service = vi.fn(async () => 42);
    const cacheProvider = new Map();

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'provider-cache-demo',
        cacheProvider
      })
    ).value;

    await first.runAsync();

    const defaultCacheState = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'provider-cache-demo'
      })
    ).value;
    const providerCacheState = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'provider-cache-demo',
        cacheProvider
      })
    ).value;

    expect(defaultCacheState.data()).toBeUndefined();
    expect(providerCacheState.data()).toBe(42);
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
    const [, failedParams] = failure.mock.calls[failure.mock.calls.length - 1]!;
    expect(failedParams).toEqual([2]);
    expect((state.error() as Error).message).toBe('boom');
  });

  it('does not treat onSuccess exceptions as service failures', async () => {
    const callbackError = new Error('callback failed');
    const failure = vi.fn();
    const done = vi.fn();
    const service = vi.fn(async () => 10);

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        onSuccess() {
          throw callbackError;
        },
        onError: failure,
        onFinally: done
      })
    );

    await expect(state.runAsync()).rejects.toBe(callbackError);

    expect(state.data()).toBe(10);
    expect(state.error()).toBeNull();
    expect(state.loading()).toBe(false);
    expect(failure).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith([], 10, null);
  });

  it('consumes lifecycle callback failures from run()', async () => {
    const service = vi.fn(async () => 10);
    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        onFinally() {
          throw new Error('detached callback failed');
        }
      })
    );

    state.run();
    await vi.waitFor(() => expect(state.loading()).toBe(false));

    expect(state.data()).toBe(10);
    expect(state.error()).toBeNull();
  });

  it('consumes lifecycle callback failures from automatic execution', async () => {
    const service = vi.fn(async () => 11);
    const { value: state } = createRoot(() =>
      useRequest(service, {
        onSuccess() {
          throw new Error('automatic callback failed');
        }
      })
    );

    await vi.waitFor(() => expect(state.loading()).toBe(false));

    expect(state.data()).toBe(11);
    expect(state.error()).toBeNull();
  });

  it('runs onFinally only for the latest concurrent request', async () => {
    let resolveFirst: ((value: number) => void) | undefined;
    const service = vi.fn((value: number) => {
      if (value === 1) {
        return new Promise<number>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(2);
    });
    const done = vi.fn();

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        onFinally: done
      })
    );

    const first = state.runAsync(1);
    const second = state.runAsync(2);
    await second;

    resolveFirst!(1);
    await first;

    expect(done).toHaveBeenCalledWith([2], 2, null);
    expect(done).toHaveBeenCalledTimes(1);
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
    const done = vi.fn();

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        onFinally: done
      })
    );

    const pending = state.runAsync();
    state.cancel();
    resolveLater!(123);
    await pending;

    expect(state.data()).toBeUndefined();
    expect(state.loading()).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it('does not retry after cancel during retry interval', async () => {
    vi.useFakeTimers();
    const service = vi
      .fn<(...args: []) => Promise<number>>()
      .mockRejectedValue(new Error('retry failure'));

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        retryCount: 2,
        retryInterval: 20
      })
    );

    const pending = state.runAsync();
    await Promise.resolve();

    state.cancel();
    await vi.advanceTimersByTimeAsync(100);
    await pending;

    expect(service).toHaveBeenCalledTimes(1);
    expect(state.loading()).toBe(false);
  });

  it('settles immediately when cancel interrupts a retry delay', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => {
      throw new Error('retry failure');
    });
    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        retryCount: 1,
        retryInterval: 60_000
      })
    );

    const pending = state.runAsync();
    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);

    state.cancel();
    await pending;

    expect(vi.getTimerCount()).toBe(0);
    expect(service).toHaveBeenCalledTimes(1);
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

  it('clears a zero-valued polling timer on dispose', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const setTimeoutRef = vi.fn(() => 0);
    const clearTimeoutRef = vi.fn();
    globalThis.setTimeout = setTimeoutRef as unknown as typeof setTimeout;
    globalThis.clearTimeout = clearTimeoutRef as unknown as typeof clearTimeout;

    try {
      const service = vi.fn(async () => 'ok');
      const { value: state, dispose } = createRoot(() =>
        useRequest(service, {
          manual: true,
          pollingInterval: 20
        })
      );

      await state.runAsync();
      expect(setTimeoutRef).toHaveBeenCalledTimes(1);

      dispose();

      expect(clearTimeoutRef).toHaveBeenCalledWith(0);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  it('does not restart requests or polling after dispose', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 'ok');
    const root = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20
      })
    );

    root.dispose();

    await expect(root.value.runAsync()).resolves.toBeUndefined();
    root.value.run();
    await expect(root.value.refresh()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);

    expect(service).not.toHaveBeenCalled();
    expect(root.value.loading()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('consumes callback failures from detached polling runs', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 12);
    const onSuccess = vi.fn(() => {
      if (service.mock.calls.length > 1) {
        throw new Error('poll callback failed');
      }
    });
    const { value: state, dispose } = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20,
        onSuccess
      })
    );

    await state.runAsync();
    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();

    expect(service).toHaveBeenCalledTimes(2);
    expect(state.data()).toBe(12);
    expect(state.loading()).toBe(false);
    dispose();
  });

  it('continues polling when onError throws', async () => {
    vi.useFakeTimers();
    const requestError = new Error('request failed');
    const callbackError = new Error('callback failed');
    const service = vi.fn(async () => {
      throw requestError;
    });
    const root = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20,
        onError() {
          throw callbackError;
        }
      })
    );

    await expect(root.value.runAsync()).rejects.toBe(callbackError);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(20);

    expect(service).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    root.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not restart polling when onSuccess disposes the root', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 'ok');
    let dispose = () => {};

    const root = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20,
        onSuccess() {
          dispose();
        }
      })
    );
    dispose = root.dispose;

    await root.value.runAsync();
    await vi.advanceTimersByTimeAsync(100);

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('does not restart polling when onError cancels the request', async () => {
    vi.useFakeTimers();
    const callbackError = new Error('callback failed');
    const service = vi.fn(async () => {
      throw new Error('failed');
    });
    let cancel = () => {};

    const { value: state } = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20,
        onError() {
          cancel();
          throw callbackError;
        }
      })
    );
    cancel = state.cancel;

    await expect(state.runAsync()).rejects.toBe(callbackError);
    await vi.advanceTimersByTimeAsync(100);

    expect(service).toHaveBeenCalledTimes(1);
  });

  it('does not restart polling when onError disposes the root', async () => {
    vi.useFakeTimers();
    const callbackError = new Error('callback failed');
    const service = vi.fn(async () => {
      throw new Error('failed');
    });
    let dispose = () => {};
    const root = createRoot(() =>
      useRequest(service, {
        manual: true,
        pollingInterval: 20,
        onError() {
          dispose();
          throw callbackError;
        }
      })
    );
    dispose = root.dispose;

    await expect(root.value.runAsync()).rejects.toBe(callbackError);
    await vi.advanceTimersByTimeAsync(100);

    expect(service).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
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

  it('evicts cache entries after cacheTime', async () => {
    vi.useFakeTimers();
    const service = vi.fn(async () => 10);

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-time-key',
        cacheTime: 5
      })
    ).value;

    await first.runAsync();
    expect(first.data()).toBe(10);

    await vi.advanceTimersByTimeAsync(6);

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-time-key',
        cacheTime: 5
      })
    ).value;

    expect(second.data()).toBeUndefined();
  });

  it('evicts oldest cache entries over cacheSize', async () => {
    const service = vi.fn(async (value: number) => value);

    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-size-first',
        cacheSize: 1
      })
    ).value;
    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-size-second',
        cacheSize: 1
      })
    ).value;

    await first.runAsync(1);
    await second.runAsync(2);

    const firstCached = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-size-first',
        cacheSize: 1
      })
    ).value;
    const secondCached = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'cache-size-second',
        cacheSize: 1
      })
    ).value;

    expect(firstCached.data()).toBeUndefined();
    expect(secondCached.data()).toBe(2);
  });

  it('refreshes cache recency when an existing entry is updated', async () => {
    const service = vi.fn(async (value: number) => value);
    const cacheProvider = new Map();
    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'recency-first',
        cacheSize: 2,
        cacheProvider
      })
    ).value;
    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'recency-second',
        cacheSize: 2,
        cacheProvider
      })
    ).value;
    const third = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'recency-third',
        cacheSize: 2,
        cacheProvider
      })
    ).value;

    await first.runAsync(1);
    await second.runAsync(2);
    await first.runAsync(10);
    await third.runAsync(3);

    expect([...cacheProvider.keys()]).toEqual(['recency-first', 'recency-third']);
    expect(cacheProvider.get('recency-first')?.data).toBe(10);
  });
});
