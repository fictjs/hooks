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
    immediateArgs?: Args;
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

## Notes

- Executors without required arguments can use `immediate: true` directly.
- Executors with required arguments must provide the matching `immediateArgs` tuple when immediate
  execution is enabled. Otherwise, leave immediate execution disabled and call `execute(...args)`.
