# usePrevious

## Purpose

Expose the previous value of a reactive source.

## API

```ts
function usePrevious<T>(value: T | (() => T)): () => T | undefined;
```

## Notes

- First read is `undefined`.
- Works with plain values and accessors.
