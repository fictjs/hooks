# useToggle

## Purpose

Boolean state helper for common on/off interactions.

## API

```ts
function useToggle(initial?: boolean): {
  value: () => boolean;
  toggle: () => void;
  set: (next: boolean) => void;
  setTrue: () => void;
  setFalse: () => void;
};
```
