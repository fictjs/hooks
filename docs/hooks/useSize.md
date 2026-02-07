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
- Works with plain elements, ref-like targets, and accessor targets.
