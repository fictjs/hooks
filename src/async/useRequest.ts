import { createSignal } from '@fictjs/runtime/advanced';
import { isClient } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

export interface UseRequestCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const requestCache = new Map<string, UseRequestCacheEntry<unknown>>();
const REQUEST_CANCELED = Symbol('REQUEST_CANCELED');
const DEFAULT_CACHE_TIME = 5 * 60 * 1000;
const DEFAULT_CACHE_SIZE = 100;

export interface UseRequestOptions<TData, TParams extends unknown[]> {
  manual?: boolean;
  defaultParams?: TParams;
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
  options: UseRequestOptions<TData, TParams> = {}
): UseRequestReturn<TData, TParams> {
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
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = undefined;
    }
  };

  const schedulePolling = (currentParams: TParams) => {
    stopPolling();

    if (!options.pollingInterval || options.pollingInterval <= 0) {
      return;
    }

    pollingTimer = setTimeout(() => {
      void runAsync(...currentParams);
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
        options.onError?.(err, currentParams);
        if (id === callId) {
          schedulePolling(currentParams);
        }
        return data();
      }

      finalData = result;
      if (id !== callId) {
        return data();
      }

      data(result);
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

  const run = (...currentParams: TParams) => {
    void runAsync(...currentParams);
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
    const next =
      typeof value === 'function' ? (value as (prev: TData | undefined) => TData)(data()) : value;
    data(next);
    saveCache(next);
  };

  applyCache();

  if (!options.manual) {
    const initialParams = options.defaultParams ?? ([] as unknown as TParams);
    void runAsync(...initialParams);
  }

  tryOnDestroy(cancel);

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
