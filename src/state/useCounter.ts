import { createSignal } from '@fictjs/runtime/advanced';

export interface UseCounterOptions {
  min?: number;
  max?: number;
}

export interface UseCounterReturn {
  count: () => number;
  set: (next: number) => void;
  inc: (delta?: number) => void;
  dec: (delta?: number) => void;
  reset: () => void;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let next = value;
  if (min != null) {
    next = Math.max(min, next);
  }
  if (max != null) {
    next = Math.min(max, next);
  }
  return next;
}

/**
 * Number state helper with optional min/max bounds.
 *
 * @fictReturn { count: 'signal' }
 */
export function useCounter(initial = 0, options: UseCounterOptions = {}): UseCounterReturn {
  const start = clamp(initial, options.min, options.max);
  const countSignal = createSignal(start);
  let operationGeneration = 0;

  const setCount = (next: number) => {
    const operation = ++operationGeneration;
    const min = options.min;
    if (operation !== operationGeneration) {
      return;
    }
    const max = options.max;
    if (operation !== operationGeneration) {
      return;
    }
    const nextCount = clamp(next, min, max);
    if (operation !== operationGeneration) {
      return;
    }
    countSignal(nextCount);
  };

  const count = function count(next?: number) {
    if (arguments.length === 0) {
      return countSignal();
    }
    setCount(next ?? 0);
  } as typeof countSignal;

  return {
    count,
    set(next) {
      setCount(next);
    },
    inc(delta = 1) {
      setCount(count() + delta);
    },
    dec(delta = 1) {
      setCount(count() - delta);
    },
    reset() {
      setCount(start);
    }
  };
}
