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
    window?: Window;
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
