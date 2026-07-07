# useIntersectionObserver

## Purpose

Observe intersection state for one or multiple target elements.

## API

```ts
function useIntersectionObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void,
  options?: {
    root?: MaybeElement;
    rootMargin?: string;
    threshold?: number | number[];
    window?: Window | null;
  }
): {
  entries: () => IntersectionObserverEntry[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
};
```

## Notes

- Observer constructors are read from the provided/default `window`; Node/SSR globals are not used
  implicitly.
