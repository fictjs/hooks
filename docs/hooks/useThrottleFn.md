# useThrottleFn

## Purpose

Throttle a function call with `run/cancel/flush/pending` controls.

## API

```ts
function useThrottleFn<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
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
const throttled = useThrottleFn(() => {
  updateScroll();
}, 16);

window.addEventListener('scroll', throttled.run);
```
