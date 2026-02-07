# useResizeObserver

## Purpose

Observe size changes for one or multiple elements.

## API

```ts
function useResizeObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void,
  options?: { box?: ResizeObserverBoxOptions; window?: Window | null }
): {
  entries: () => ResizeObserverEntry[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
};
```
