# useTitle

## Purpose

Set and track `document.title` reactively.

## API

```ts
function useTitle(
  value: string | (() => string),
  options?: {
    document?: Document | null;
    restoreOnUnmount?: boolean;
  }
): {
  title: () => string;
};
```

## Notes

- Accepts static string or accessor.
- Supports SSR-safe mode with `document: null`.
- Can restore the previous title on unmount with `restoreOnUnmount`.
