# useMediaQuery

## Purpose

Track whether a media query currently matches.

## API

```ts
function useMediaQuery(
  query: string | (() => string),
  options?: { window?: Window | null; initialValue?: boolean }
): {
  matches: () => boolean;
  query: () => string;
  isSupported: () => boolean;
};
```

## Notes

- Re-subscribes when query changes.
- Supports SSR fallback via `initialValue`.
