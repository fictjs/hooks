# useScroll

## Purpose

Track scroll position for window, document, or specific element targets.

## API

```ts
function useScroll(options?: {
  target?:
    | Element
    | Document
    | Window
    | { current?: Element | Document | Window | null }
    | (() => Element | Document | Window | null)
    | null;
  window?: Window | null;
  initialX?: number;
  initialY?: number;
  shouldUpdate?: (next: { x: number; y: number }, prev: { x: number; y: number }) => boolean;
  passive?: boolean;
  capture?: boolean;
}): {
  x: () => number;
  y: () => number;
  refresh: () => void;
};
```

## Notes

- Default target is `window`.
- `target: null` disables listener and keeps fallback values.
- `shouldUpdate` can be used to filter noisy updates.
- Call `refresh()` after changing a non-reactive ref to rebind the listener and read its position.
