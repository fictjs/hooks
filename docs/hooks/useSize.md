# useSize

## Purpose

Track an element's size and position reactively.

## API

```ts
function useSize(
  target: Element | { current?: Element | null } | (() => Element | null) | null,
  options?: {
    window?: Window | null;
    box?: ResizeObserverBoxOptions;
    initialWidth?: number;
    initialHeight?: number;
    initialTop?: number;
    initialLeft?: number;
    initialX?: number;
    initialY?: number;
    immediate?: boolean;
  }
): {
  width: () => number;
  height: () => number;
  top: () => number;
  left: () => number;
  x: () => number;
  y: () => number;
  isSupported: () => boolean;
  active: () => boolean;
  update: () => void;
  start: () => void;
  stop: () => void;
};
```

## Notes

- Uses `ResizeObserver` when available and falls back to `window.resize` updates.
- Width and height use the border box by default, matching the synchronous
  `getBoundingClientRect()` measurement. Pass `box` to request another observer box.
- `ResizeObserver` is read from the provided/default `window`; Node/SSR globals are not used
  implicitly.
- Works with plain elements, ref-like targets, and accessor targets.
