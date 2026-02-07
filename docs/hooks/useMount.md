# useMount

## Purpose

Run logic once when the current Fict root is mounted.

## API

```ts
function useMount(callback: () => void | (() => void)): void;
```

## Notes

- If the callback returns a cleanup function, it runs when the root is disposed.
- If called outside a root, callback executes immediately.

## Example

```ts
import { useMount } from '@fictjs/hooks';

useMount(() => {
  console.log('mounted');
  return () => console.log('disposed');
});
```
