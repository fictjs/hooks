# useUnmount

## Purpose

Register cleanup logic that runs when the current Fict root is disposed.

## API

```ts
function useUnmount(callback: () => void | (() => void)): void;
```

## Notes

- Inside a root, callback runs during dispose.
- Outside a root, callback executes immediately.

## Example

```ts
import { useUnmount } from '@fictjs/hooks';

useUnmount(() => {
  console.log('root disposed');
});
```
