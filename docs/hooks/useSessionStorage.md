# useSessionStorage

## Purpose

Convenience wrapper around `useStorage` using `window.sessionStorage`.

## API

```ts
function useSessionStorage<T>(
  key: string,
  initial: T,
  options?: {
    window?: Window | null;
    listenToStorageChanges?: boolean;
    writeDefaults?: boolean;
    serializer?: {
      read: (raw: string) => T;
      write: (value: T) => string;
    };
    onError?: (error: unknown) => void;
  }
): {
  value: {
    (): T;
    (next: T | ((prev: T) => T)): void;
  };
  set: (next: T | ((prev: T) => T)) => void;
  remove: () => void;
};
```

## Notes

- `window: null` uses an in-memory signal and does not touch real `sessionStorage`.
- Direct writes through `value(next)` are persisted the same way as `set(next)`.
- Writing `undefined` removes the storage entry and resets the value to `initial`.
