# useKeyPress

## Purpose

Handle keyboard events with flexible key filters.

## API

```ts
type KeyFilter = string | string[] | ((event: KeyboardEvent) => boolean);

function useKeyPress(
  filter: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options?: {
    target?: EventTarget | { current?: EventTarget | null } | (() => EventTarget | null) | null;
    events?: 'keydown' | 'keyup' | 'keypress' | Array<'keydown' | 'keyup' | 'keypress'>;
    exactMatch?: boolean;
    passive?: boolean;
    capture?: boolean;
    preventDefault?: boolean;
    immediate?: boolean;
  }
): {
  start: () => void;
  stop: () => void;
  active: () => boolean;
};
```

## Notes

- Supports combo syntax like `ctrl.k` or `ctrl+k`.
- `exactMatch` requires modifier keys to match exactly.
- `preventDefault` automatically disables passive listener mode.
