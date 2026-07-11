# useFocusWithin

## Purpose

Track whether focus is currently inside a target element.

## API

```ts
function useFocusWithin(
  target: Element | { current?: Element | null } | (() => Element | null) | null,
  options?: {
    initialValue?: boolean;
  }
): {
  focused: () => boolean;
  refresh: () => void;
};
```

## Notes

- Uses `focusin` and `focusout` events.
- If `relatedTarget` remains inside the target, focus state stays `true`.
- Resets to `initialValue` when target changes.
- Call `refresh()` after assigning a non-reactive ref asynchronously.
