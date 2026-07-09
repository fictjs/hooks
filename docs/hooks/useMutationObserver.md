# useMutationObserver

## Purpose

Observe DOM mutations (`childList`, `subtree`, `attributes`, etc.) for target elements.

## API

```ts
function useMutationObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (records: MutationRecord[], observer: MutationObserver) => void,
  options?: MutationObserverInit & { window?: Window | null }
): {
  records: () => MutationRecord[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
  refresh: () => void;
};
```

## Notes

- Observer constructors are read from the provided/default `window`; Node/SSR globals are not used
  implicitly.
- Call `refresh()` after assigning non-reactive refs asynchronously.
