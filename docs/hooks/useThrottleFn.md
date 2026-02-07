# useThrottleFn

## Purpose

Throttle a function call with `run/cancel/flush/pending` controls.

## API

```ts
function useThrottleFn<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
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
const throttled = useThrottleFn(() => {
  updateScroll();
}, 16);

window.addEventListener('scroll', throttled.run);
```
