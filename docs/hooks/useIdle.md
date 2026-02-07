# useIdle

## Purpose

Track whether user activity has been idle for a configured timeout.

## API

```ts
function useIdle(options?: {
  timeout?: number;
  window?: Window | null;
  document?: Document | null;
  events?: string[];
  listenForVisibilityChange?: boolean;
  immediate?: boolean;
  initialState?: boolean;
}): {
  idle: () => boolean;
  lastActive: () => number | null;
  isSupported: () => boolean;
  active: () => boolean;
  reset: () => void;
  pause: () => void;
  resume: () => void;
};
```

## Notes

- Uses activity events on `window` and an internal timeout.
- `pause()`/`resume()` controls listener binding and timer scheduling.
