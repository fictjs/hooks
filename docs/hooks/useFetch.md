# useFetch

## Purpose

Lightweight fetch hook with loading/error/data state and abort control.

## API

```ts
function useFetch<T = unknown>(
  input: RequestInfo | URL | (() => RequestInfo | URL),
  options?: {
    immediate?: boolean;
    initialData?: T | null;
    fetch?: typeof fetch;
    parse?: (response: Response) => Promise<T>;
    onError?: (error: unknown) => void;
    init?: RequestInit;
  }
): {
  data: () => T | null;
  error: () => unknown;
  isLoading: () => boolean;
  status: () => number | null;
  aborted: () => boolean;
  execute: (init?: RequestInit) => Promise<T | null>;
  abort: () => void;
};
```
