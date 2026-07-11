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
  refresh: () => void;
};
```

## Notes

- Uses `ResizeObserver` when available and falls back to `window.resize` updates.
- ResizeObserver width and height updates use the requested `box` (`border-box` by default).
  This option applies only to observer-delivered measurements.
- The initial synchronous measurement, `update()`, and the window-resize fallback use
  `getBoundingClientRect()`. Its visual bounding rectangle can include CSS transforms and does
  not represent `content-box` or `device-pixel-content-box` dimensions. Width and height may
  therefore change when the first observer entry arrives, and a later synchronous update can
  return to the bounding-rectangle value until another observer entry is delivered.
- `ResizeObserver` is read from the provided/default `window`; Node/SSR globals are not used
  implicitly.
- Works with plain elements, ref-like targets, and accessor targets.
- Call `refresh()` after changing a non-reactive ref to rebuild its observer and event listeners.
