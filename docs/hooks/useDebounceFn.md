# useDebounceFn

## Purpose

Debounce a function call with `run/cancel/flush/pending` controls.

## API

```ts
function useDebounceFn<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  }
): {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};
```

## Example

```ts
const debounced = useDebounceFn((value: string) => {
  search(value);
}, 300);

debounced.run('fict');
```
