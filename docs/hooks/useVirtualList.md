# useVirtualList

## Purpose

Fixed-height virtual list helper for large datasets.

## API

```ts
function useVirtualList<T>(
  source: T[] | (() => T[]),
  options: {
    itemHeight: number;
    containerHeight: number | (() => number);
    overscan?: number;
    initialScrollTop?: number;
  }
): {
  list: () => Array<{ index: number; data: T; start: number; end: number }>;
  totalHeight: () => number;
  start: () => number;
  end: () => number;
  scrollTop: () => number;
  setScrollTop: (value: number) => void;
  scrollTo: (index: number) => void;
  onScroll: (event: Event) => void;
};
```
