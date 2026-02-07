# useWindowScroll

## Purpose

Track `window` scroll position as reactive signals.

## API

```ts
function useWindowScroll(options?: {
  window?: Window | null;
  initialX?: number;
  initialY?: number;
  shouldUpdate?: (next: { x: number; y: number }, prev: { x: number; y: number }) => boolean;
  passive?: boolean;
  capture?: boolean;
}): {
  x: () => number;
  y: () => number;
};
```

## Notes

- Built on top of `useScroll`.
- Supports SSR-safe fallback via `window: null`.
