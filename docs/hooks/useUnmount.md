# useUnmount

## Purpose

Register cleanup logic that runs when the current Fict root is disposed.

## API

```ts
function useUnmount(callback: () => void | (() => void)): void;
```

## Notes

- Inside a root, callback runs during dispose.
- Outside a root, no cleanup is registered and the callback is not executed.

## Example

```tsx
import { useUnmount } from '@fictjs/hooks';

export function Component() {
  useUnmount(() => {
    console.log('root disposed');
  });

  return <div />;
}
```
