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
  const count = createSignal(start);

  return {
    count,
    set(next) {
      count(clamp(next, options.min, options.max));
    },
    inc(delta = 1) {
      count(clamp(count() + delta, options.min, options.max));
    },
    dec(delta = 1) {
      count(clamp(count() - delta, options.min, options.max));
    },
    reset() {
      count(start);
    }
  };
}
