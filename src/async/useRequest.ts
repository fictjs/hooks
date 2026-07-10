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

function pruneExpiredCache<T>(
  cache: Map<string, UseRequestCacheEntry<T>>,
  now = Date.now(),
  ownsOperation: () => boolean = () => true
): boolean {
  for (const [key, entry] of cache) {
    if (!ownsOperation()) {
      return false;
    }

    const expiresAt = entry.expiresAt;
    if (!ownsOperation()) {
      return false;
    }

    if (expiresAt <= now) {
      cache.delete(key);
      if (!ownsOperation()) {
        return false;
      }
    }
  }

  return ownsOperation();
}

function pruneCacheSize<T>(
  cache: Map<string, UseRequestCacheEntry<T>>,
  maxSize: number,
  ownsOperation: () => boolean = () => true
): boolean {
  if (maxSize < 0) {
    return ownsOperation();
  }

  while (ownsOperation() && cache.size > maxSize) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!ownsOperation()) {
      return false;
    }
    if (oldestKey == null) {
      return ownsOperation();
    }
    cache.delete(oldestKey);
  }

  return ownsOperation();
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
  let pollingGeneration = 0;
  const retryDelayCancelers = new Set<() => void>();
  let disposed = false;
  let commitGeneration = 0;
  let refreshGeneration = 0;

  const waitForRetry = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const registration: { timer?: ReturnType<typeof setTimeout> } = {};
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (registration.timer !== undefined) {
          clearTimeout(registration.timer);
        }
        retryDelayCancelers.delete(finish);
        resolve();
      };
      retryDelayCancelers.add(finish);
      const nextTimer = setTimeout(finish, ms);
      if (settled) {
        clearTimeout(nextTimer);
        return;
      }
      registration.timer = nextTimer;
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

  const saveCache = (value: TData, ownsOperation: () => boolean = () => true): boolean => {
    if (!ownsOperation()) {
      return false;
    }

    const cacheKey = options.cacheKey;
    if (!ownsOperation() || !cacheKey) {
      return ownsOperation();
    }

    const cacheTime = options.cacheTime ?? DEFAULT_CACHE_TIME;
    if (!ownsOperation()) {
      return false;
    }
    const cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE;
    if (!ownsOperation()) {
      return false;
    }
    if (cacheTime <= 0 || cacheSize <= 0) {
      cache.delete(cacheKey);
      return ownsOperation();
    }

    const now = Date.now();
    if (!ownsOperation() || !pruneExpiredCache(cache, now, ownsOperation)) {
      return false;
    }
    cache.delete(cacheKey);
    if (!ownsOperation()) {
      return false;
    }
    cache.set(cacheKey, {
      data: value,
      timestamp: now,
      expiresAt: Number.isFinite(cacheTime) ? now + cacheTime : Infinity
    });
    if (!ownsOperation()) {
      return false;
    }
    return pruneCacheSize(cache, cacheSize, ownsOperation);
  };

  const stopPolling = () => {
    const currentTimer = pollingTimer;
    pollingTimer = undefined;
    pollingGeneration += 1;
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
    }
  };

  const schedulePolling = (currentParams: TParams, currentId: number) => {
    stopPolling();
    if (disposed || currentId !== callId) {
      return;
    }

    const pollingInterval = options.pollingInterval;
    if (disposed || currentId !== callId || !pollingInterval || pollingInterval <= 0) {
      return;
    }

    const generation = ++pollingGeneration;
    let nextTimer: ReturnType<typeof setTimeout>;
    try {
      nextTimer = setTimeout(() => {
        if (disposed || currentId !== callId || generation !== pollingGeneration) {
          return;
        }
        pollingTimer = undefined;
        pollingGeneration += 1;
        runDetached(currentParams);
      }, pollingInterval);
    } catch (error) {
      if (generation === pollingGeneration) {
        pollingGeneration += 1;
      }
      throw error;
    }

    if (disposed || currentId !== callId || generation !== pollingGeneration) {
      try {
        clearTimeout(nextTimer);
      } catch {
        // A terminal or superseding operation owns no live polling timer.
      }
      return;
    }
    pollingTimer = nextTimer;
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

    const id = ++callId;
    stopRetryDelays();
    if (disposed || id !== callId) {
      return data();
    }

    let finalData: TData | undefined;
    let finalError: unknown = null;

    stopPolling();
    if (disposed || id !== callId) {
      return data();
    }

    loading(true);
    if (disposed || id !== callId) {
      return data();
    }

    error(null);
    if (disposed || id !== callId) {
      return data();
    }

    params(currentParams);
    if (disposed || id !== callId) {
      return data();
    }

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
        if (disposed || id !== callId) {
          return data();
        }

        const onError = options.onError;
        if (disposed || id !== callId) {
          return data();
        }

        try {
          onError?.(err, currentParams);
        } finally {
          if (id === callId) {
            schedulePolling(currentParams, id);
          }
        }
        return data();
      }

      finalData = result;
      if (id !== callId) {
        return data();
      }

      const commitId = ++commitGeneration;
      const ownsCommit = () => !disposed && id === callId && commitId === commitGeneration;
      data(result);
      if (!ownsCommit()) {
        return data();
      }

      if (!saveCache(result, ownsCommit)) {
        return data();
      }

      const onSuccess = options.onSuccess;
      if (!ownsCommit()) {
        return data();
      }

      try {
        onSuccess?.(result, currentParams);
      } finally {
        if (id === callId) {
          schedulePolling(currentParams, id);
        }
      }
      return result;
    } finally {
      if (id === callId) {
        loading(false);
        if (!disposed && id === callId) {
          const onFinally = options.onFinally;
          if (!disposed && id === callId) {
            onFinally?.(currentParams, finalData, finalError);
          }
        }
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
    if (disposed) {
      return data();
    }

    const id = ++refreshGeneration;
    const requestId = callId;
    const currentParams = params() ?? options.defaultParams;
    if (disposed || id !== refreshGeneration || requestId !== callId) {
      return data();
    }
    if (!currentParams) {
      return data();
    }

    const resolvedParams = [...currentParams] as TParams;
    if (disposed || id !== refreshGeneration || requestId !== callId) {
      return data();
    }

    return runAsync(...resolvedParams);
  };

  const mutate = (value: TData | ((prev: TData | undefined) => TData)) => {
    if (disposed) {
      return;
    }

    const requestId = callId;
    const commitId = ++commitGeneration;
    const ownsCommit = () => !disposed && requestId === callId && commitId === commitGeneration;
    const next =
      typeof value === 'function' ? (value as (prev: TData | undefined) => TData)(data()) : value;
    if (!ownsCommit()) {
      return;
    }

    data(next);
    if (!ownsCommit()) {
      return;
    }

    saveCache(next, ownsCommit);
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
