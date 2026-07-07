# useLocalStorage

## Purpose

Convenience wrapper around `useStorage` using `window.localStorage`.

## API

```ts
function useLocalStorage<T>(
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
  value: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  remove: () => void;
};
```

## Notes

- `window: null` uses an in-memory signal and does not touch real `localStorage`.
- Direct writes through `value(next)` are persisted the same way as `set(next)`.
