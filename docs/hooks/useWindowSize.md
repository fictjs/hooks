# useWindowSize

## Purpose

Track current window width and height.

## API

```ts
function useWindowSize(options?: {
  window?: Window;
  initialWidth?: number;
  initialHeight?: number;
}): {
  width: () => number;
  height: () => number;
};
```

## Notes

- Automatically subscribes to `resize`.
- Supports SSR fallback via `initialWidth/initialHeight`.
