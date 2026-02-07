# useIntervalFn

## Purpose

Create a controlled interval timer.

## API

```ts
function useIntervalFn(
  callback: () => void,
  interval: number | (() => number)
): {
  run: () => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};
```

## Notes

- Starts interval immediately.
- `cancel()` stops further ticks.
- `run()` starts interval again.

## Example

```ts
const timer = useIntervalFn(() => {
  console.log('polling');
}, 1000);

timer.cancel();
```
