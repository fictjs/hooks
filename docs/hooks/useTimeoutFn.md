# useTimeoutFn

## Purpose

Create a controlled timeout with `run/cancel/flush` APIs.

## API

```ts
function useTimeoutFn(
  callback: () => void,
  delay: number | (() => number)
): {
  run: () => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};
```

## Notes

- Starts one timeout immediately on hook creation.
- `run()` restarts the timeout.
- `flush()` runs callback immediately if pending.

## Example

```ts
const timeout = useTimeoutFn(() => {
  console.log('save');
}, 400);

timeout.cancel();
timeout.run();
```
