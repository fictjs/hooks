import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const requestCache = new Map<string, CacheEntry<unknown>>();
const REQUEST_CANCELED = Symbol('REQUEST_CANCELED');

export interface UseRequestOptions<TData, TParams extends unknown[]> {
  manual?: boolean;
  defaultParams?: TParams;
  retryCount?: number;
  retryInterval?: number;
  pollingInterval?: number;
  cacheKey?: string;
  staleTime?: number;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let callId = 0;
  let pollingTimer: ReturnType<typeof setTimeout> | undefined;

  const applyCache = () => {
    if (!options.cacheKey) {
      return;
    }

    const entry = requestCache.get(options.cacheKey) as CacheEntry<TData> | undefined;
    if (!entry) {
      return;
    }

    const staleTime = options.staleTime ?? 0;
    if (staleTime > 0 && Date.now() - entry.timestamp > staleTime) {
      requestCache.delete(options.cacheKey);
      return;
    }

    data(entry.data);
  };

  const saveCache = (value: TData) => {
    if (!options.cacheKey) {
      return;
    }

    requestCache.set(options.cacheKey, {
      data: value,
      timestamp: Date.now()
    });
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
        await delay(retryInterval);
      }
    }
  };

  const runAsync = async (...currentParams: TParams): Promise<TData | undefined> => {
    const id = ++callId;
    let finalData: TData | undefined;
    let finalError: unknown = null;

    stopPolling();
    loading(true);
    error(null);
    params(currentParams);

    try {
      const result = await runWithRetry(currentParams, id);
      finalData = result;
      if (id !== callId) {
        return data();
      }

      data(result);
      saveCache(result);
      options.onSuccess?.(result, currentParams);
      schedulePolling(currentParams);
      return result;
    } catch (err) {
      if (id !== callId || err === REQUEST_CANCELED) {
        return data();
      }

      finalError = err;
      error(err);
      options.onError?.(err, currentParams);
      schedulePolling(currentParams);
      return data();
    } finally {
      if (id === callId) {
        loading(false);
      }
      options.onFinally?.(currentParams, finalData, finalError);
    }
  };

  const run = (...currentParams: TParams) => {
    void runAsync(...currentParams);
  };

  const cancel = () => {
    callId += 1;
    loading(false);
    stopPolling();
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

  if (!options.manual && options.defaultParams) {
    void runAsync(...options.defaultParams);
  }

  onDestroy(cancel);

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
