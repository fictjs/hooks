# useCounter

## Purpose

Numeric state helper with `inc/dec/reset` actions and optional bounds.

## API

```ts
function useCounter(
  initial?: number,
  options?: { min?: number; max?: number }
): {
  count: () => number;
  set: (next: number) => void;
  inc: (delta?: number) => void;
  dec: (delta?: number) => void;
  reset: () => void;
};
```
