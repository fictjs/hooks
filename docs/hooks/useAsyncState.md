# useAsyncState

## Purpose

Manage loading/error/state around async operations with stale-result protection.

## API

```ts
function useAsyncState<T, Args extends unknown[] = []>(
  executor: (...args: Args) => Promise<T>,
  initialState: T,
  options?: {
    immediate?: boolean;
    resetOnExecute?: boolean;
    onError?: (error: unknown) => void;
  }
): {
  state: () => T;
  isLoading: () => boolean;
  error: () => unknown;
  execute: (...args: Args) => Promise<T>;
};
```
