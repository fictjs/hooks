# useRequest

## Purpose

A lightweight request manager with manual mode, retry, polling, cache, refresh and mutate.

## API

```ts
function useRequest<TData, TParams extends unknown[] = []>(
  service: (...params: TParams) => Promise<TData>,
  options?: {
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
): {
  data: () => TData | undefined;
  error: () => unknown;
  loading: () => boolean;
  params: () => TParams | undefined;
  run: (...params: TParams) => void;
  runAsync: (...params: TParams) => Promise<TData | undefined>;
  cancel: () => void;
  refresh: () => Promise<TData | undefined>;
  mutate: (value: TData | ((prev: TData | undefined) => TData)) => void;
};

interface UseRequestCacheEntry<TData> {
  data: TData;
  timestamp: number;
  expiresAt: number;
}

function clearRequestCache(cacheKey?: string): void;
```

## Notes

- Services with required parameters must either provide `defaultParams` for automatic execution or
  set `manual: true`; the TypeScript API rejects an unsafe parameterless automatic call.
- `cacheKey` enables shared in-memory cache across hook instances.
- `staleTime` controls when cached data is considered too old to apply.
- `cacheTime` bounds how long a cache entry stays in the global cache; the default is five minutes.
- `cacheSize` bounds the global request cache; the default keeps the newest 100 entries.
- In browsers, the default cache is shared across hook instances. During SSR/Node execution,
  the default cache is isolated per hook to prevent data from crossing requests. Pass a
  request-scoped `cacheProvider` when server-side hooks need to share cached values.
- Use `clearRequestCache(cacheKey?)` to clear the browser default cache.
- Stale or canceled requests do not update state and do not trigger `onSuccess`, `onError`, or
  `onFinally`; callbacks are latest-request only.
- `runAsync()` propagates lifecycle callback exceptions to its caller. Detached `run()`, automatic,
  and polling executions consume those exceptions because no caller can observe their promise.
