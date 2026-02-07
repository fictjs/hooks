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
```
