# useDebounceFn

## Purpose

Debounce a function call with `run/cancel/flush/pending` controls.

## API

```ts
function useDebounceFn<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  }
): {
  run: (...args: Args) => void;
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
