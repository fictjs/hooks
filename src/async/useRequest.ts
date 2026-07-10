import { createSignal } from '@fictjs/runtime/advanced';
import { isClient } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
import type { NoInferCompat } from '../internal/types';

export interface UseRequestCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const requestCache = new Map<string, UseRequestCacheEntry<unknown>>();
const REQUEST_CANCELED = Symbol('REQUEST_CANCELED');
const DEFAULT_CACHE_TIME = 5 * 60 * 1000;
const DEFAULT_CACHE_SIZE = 100;

interface UseRequestBaseOptions<TData, TParams extends unknown[]> {
  retryCount?: number;
  retryInterval?: number;
  pollingInterval?: number;
  cacheKey?: string;
  staleTime?: number;
  cacheTime?: number;
  cacheSize?: number;
  cacheProvider?: Map<string, UseRequestCacheEntry<TData>>;
  onSuccess?: (data: TData, params: TParams) => void;
  onError?: (error: unknown, params: TParams) => void;
  onFinally?: (params: TParams, data?: TData, error?: unknown) => void;
}

type UseRequestExecutionOptions<TParams extends unknown[]> = [] extends TParams
  ? {
      manual?: boolean;
      defaultParams?: TParams;
    }
  :
      | {
          manual: true;
          defaultParams?: TParams;
        }
      | {
          manual?: false;
          defaultParams: TParams;
        };

export type UseRequestOptions<TData, TParams extends unknown[]> = UseRequestBaseOptions<
  TData,
  TParams
> &
  UseRequestExecutionOptions<TParams>;

export interface UseRequestReturn<TData, TParams extends unknown[]> {
  data: () => TData | undefined;
  error: () => unknown;
  loading: () => boolean;
  params: () => TParams | undefined;
  run: (...params: TParams) => void;
  runAsync: (...params: TParams) => Promise<TData | undefined>;
  cancel: () => void;
  refresh: () => Promise<TData | undefined>;
  mutate: (value: TData | ((prev: TData | undefined) => TData)) => void;
}

type UseRequestOptionsTuple<TData, TParams extends unknown[]> = [] extends TParams
  ? [options?: UseRequestOptions<TData, TParams>]
  : [options: UseRequestOptions<TData, TParams>];

export function clearRequestCache(cacheKey?: string): void {
  if (cacheKey === undefined) {
    requestCache.clear();
    return;
  }
  requestCache.delete(cacheKey);
}

function pruneExpiredCache<T>(cache: Map<string, UseRequestCacheEntry<T>>, now = Date.now()): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function pruneCacheSize<T>(cache: Map<string, UseRequestCacheEntry<T>>, maxSize: number): void {
  if (maxSize < 0) {
    return;
  }

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey == null) {
      return;
    }
    cache.delete(oldestKey);
  }
}

/**
 * Lightweight request manager with retry, polling and cache.
 *
 * @fictReturn { data: 'signal', error: 'signal', loading: 'signal', params: 'signal' }
 */
export function useRequest<TData, TParams extends unknown[] = []>(
  service: (...params: TParams) => Promise<TData>,
  ...optionsTuple: UseRequestOptionsTuple<TData, NoInferCompat<TParams>>
): UseRequestReturn<TData, TParams> {
  const options = (optionsTuple[0] ?? {}) as UseRequestOptions<TData, TParams>;
  const data = createSignal<TData | undefined>(undefined);
  const error = createSignal<unknown>(null);
  const loading = createSignal(false);
  const params = createSignal<TParams | undefined>(options.defaultParams);
  const cache = (options.cacheProvider ?? (isClient ? requestCache : new Map())) as Map<
    string,
    UseRequestCacheEntry<TData>
  >;

  let callId = 0;
  let pollingTimer: ReturnType<typeof setTimeout> | undefined;
  const retryDelayCancelers = new Set<() => void>();
  let disposed = false;

  const waitForRetry = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        retryDelayCancelers.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      retryDelayCancelers.add(finish);
    });
  };

  const stopRetryDelays = () => {
    for (const cancelDelay of [...retryDelayCancelers]) {
      cancelDelay();
    }
  };

  const applyCache = () => {
    if (!options.cacheKey) {
      return;
    }

    pruneExpiredCache(cache);

    const entry = cache.get(options.cacheKey);
    if (!entry) {
      return;
    }

    const staleTime = options.staleTime ?? 0;
    if (staleTime > 0 && Date.now() - entry.timestamp > staleTime) {
      cache.delete(options.cacheKey);
      return;
    }

    data(entry.data);
  };

  const saveCache = (value: TData) => {
    if (!options.cacheKey) {
      return;
    }

    const cacheTime = options.cacheTime ?? DEFAULT_CACHE_TIME;
    const cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE;
    if (cacheTime <= 0 || cacheSize <= 0) {
      cache.delete(options.cacheKey);
      return;
    }

    const now = Date.now();
    pruneExpiredCache(cache, now);
    cache.delete(options.cacheKey);
    cache.set(options.cacheKey, {
      data: value,
      timestamp: now,
      expiresAt: Number.isFinite(cacheTime) ? now + cacheTime : Infinity
    });
    pruneCacheSize(cache, cacheSize);
  };

  const stopPolling = () => {
    if (pollingTimer !== undefined) {
      clearTimeout(pollingTimer);
      pollingTimer = undefined;
    }
  };

  const schedulePolling = (currentParams: TParams) => {
    stopPolling();

    if (disposed || !options.pollingInterval || options.pollingInterval <= 0) {
      return;
    }

    pollingTimer = setTimeout(() => {
      runDetached(currentParams);
    }, options.pollingInterval);
  };

  const runWithRetry = async (currentParams: TParams, currentId: number): Promise<TData> => {
    const retryCount = options.retryCount ?? 0;
    const retryInterval = options.retryInterval ?? 1000;

    let attempt = 0;
    while (true) {
      if (currentId !== callId) {
        throw REQUEST_CANCELED;
      }

      try {
        return await service(...currentParams);
      } catch (err) {
        if (currentId !== callId) {
          throw REQUEST_CANCELED;
        }

        if (attempt >= retryCount) {
          throw err;
        }

        attempt += 1;
        await waitForRetry(retryInterval);
      }
    }
  };

  const runAsync = async (...currentParams: TParams): Promise<TData | undefined> => {
    if (disposed) {
      return data();
    }

    stopRetryDelays();
    const id = ++callId;
    let finalData: TData | undefined;
    let finalError: unknown = null;

    stopPolling();
    loading(true);
    error(null);
    params(currentParams);

    try {
      let result: TData;
      try {
        result = await runWithRetry(currentParams, id);
      } catch (err) {
        if (id !== callId || err === REQUEST_CANCELED) {
          return data();
        }

        finalError = err;
        error(err);
        try {
          options.onError?.(err, currentParams);
        } finally {
          if (id === callId) {
            schedulePolling(currentParams);
          }
        }
        return data();
      }

      finalData = result;
      if (id !== callId) {
        return data();
      }

      data(result);
      if (disposed || id !== callId) {
        return data();
      }

      saveCache(result);
      try {
        options.onSuccess?.(result, currentParams);
      } finally {
        if (id === callId) {
          schedulePolling(currentParams);
        }
      }
      return result;
    } finally {
      if (id === callId) {
        loading(false);
        options.onFinally?.(currentParams, finalData, finalError);
      }
    }
  };

  const runDetached = (currentParams: TParams) => {
    void runAsync(...currentParams).catch(() => {
      // Detached executions have no caller to receive lifecycle callback failures.
    });
  };

  const run = (...currentParams: TParams) => {
    runDetached(currentParams);
  };

  const cancel = () => {
    callId += 1;
    loading(false);
    stopPolling();
    stopRetryDelays();
  };

  const refresh = async () => {
    const currentParams = params() ?? options.defaultParams;
    if (!currentParams) {
      return data();
    }
    return runAsync(...currentParams);
  };

  const mutate = (value: TData | ((prev: TData | undefined) => TData)) => {
    if (disposed) {
      return;
    }

    const next =
      typeof value === 'function' ? (value as (prev: TData | undefined) => TData)(data()) : value;
    if (disposed) {
      return;
    }

    data(next);
    saveCache(next);
  };

  applyCache();

  if (!options.manual) {
    const initialParams = options.defaultParams ?? ([] as unknown as TParams);
    runDetached(initialParams);
  }

  tryOnDestroy(() => {
    disposed = true;
    cancel();
  });

  return {
    data,
    error,
    loading,
    params,
    run,
    runAsync,
    cancel,
    refresh,
    mutate
  };
}
