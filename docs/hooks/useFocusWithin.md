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
};
```

## Notes

- Uses `focusin` and `focusout` events.
- If `relatedTarget` remains inside the target, focus state stays `true`.
- Resets to `initialValue` when target changes.
