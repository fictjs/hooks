# useHover

## Purpose

Track whether a target element is currently hovered.

## API

```ts
function useHover(
  target: Element | { current?: Element | null } | (() => Element | null) | null,
  options?: {
    initialValue?: boolean;
  }
): {
  hovered: () => boolean;
};
```

## Notes

- Uses `pointerenter` / `pointerleave` events.
- Resets to `initialValue` when target changes.
