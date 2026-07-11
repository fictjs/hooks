# useEventListener

## Purpose

Attach event listeners with automatic cleanup and optional start/stop controls.

## API

```ts
function useEventListener<E extends Event>(
  target: EventTarget | EventTarget[] | RefLike<EventTarget> | (() => EventTarget | null),
  event: string | string[] | (() => string | string[]),
  handler: (event: E) => void,
  options?: AddEventListenerOptions & { immediate?: boolean }
): {
  start: () => void;
  stop: () => void;
  refresh: () => void;
  active: () => boolean;
};
```

## Notes

- Supports array events: `['pointerdown', 'click']`.
- Supports reactive target/event via getter.
- Call `refresh()` after assigning a non-reactive ref asynchronously. `start()` also retries
  binding when the listener is active but has no resolved target.
- All listeners are removed on root dispose.

## Example

```ts
useEventListener(window, 'resize', () => {
  console.log('resized');
});
```
