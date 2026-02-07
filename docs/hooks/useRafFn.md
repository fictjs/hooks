# useRafFn

## Purpose

Run a controlled `requestAnimationFrame` loop.

## API

```ts
function useRafFn(
  callback: (delta: number, timestamp: number) => void,
  options?: { immediate?: boolean; window?: Window | null }
): {
  active: () => boolean;
  start: () => void;
  stop: () => void;
};
```
