# useStorage

## Purpose

General storage-backed state hook with pluggable storage and serializer.

## API

```ts
function useStorage<T>(
  key: string,
  initial: T,
  options?: {
    storage?: Storage | null;
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

- `window: null` disables default browser storage lookup and same-window sync.
- `listenToStorageChanges: false` disables cross-document and same-window storage listeners.
- `writeDefaults: false` prevents writing the initial value when the key is missing.
- Direct writes through `value(next)` are persisted the same way as `set(next)`.
