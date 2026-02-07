# useFullscreen

## Purpose

Control fullscreen state for a target element.

## API

```ts
function useFullscreen(options?: {
  target?: Element | { current?: Element | null } | (() => Element | null) | null;
  document?: Document | null;
  autoExit?: boolean;
}): {
  isSupported: () => boolean;
  isFullscreen: () => boolean;
  enter: () => Promise<boolean>;
  exit: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
};
```

## Notes

- Uses standard and vendor-prefixed fullscreen methods.
- `autoExit` triggers `exit()` when current root is disposed.
