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
};
```
