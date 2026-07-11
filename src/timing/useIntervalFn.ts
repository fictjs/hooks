import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface UseIntervalFnControls {
  run: () => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

/**
 * Create a managed interval with pause and resume controls.
 *
 * @fictReturn { pending: 'signal' }
 */
export function useIntervalFn(
  callback: () => void,
  interval: number | MaybeAccessor<number>
): UseIntervalFnControls {
  const pending = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let disposed = false;

  const cancelTimer = () => {
    generation += 1;
    const currentTimer = timer;
    timer = undefined;
    pending(false);
    if (currentTimer !== undefined) {
      clearInterval(currentTimer);
    }
  };

  const cancel = () => {
    if (!disposed) {
      cancelTimer();
    }
  };

  const run = () => {
    if (disposed) {
      return;
    }
    cancel();
    if (disposed) {
      return;
    }
    const wait = Math.max(0, toValue(interval as MaybeAccessor<number>));
    if (disposed) {
      return;
    }
    pending(true);
    if (disposed) {
      return;
    }
    const currentGeneration = ++generation;
    let nextTimer: ReturnType<typeof setInterval>;
    try {
      nextTimer = setInterval(() => {
        if (!disposed && currentGeneration === generation) {
          callback();
        }
      }, wait);
    } catch (error) {
      if (currentGeneration === generation) {
        timer = undefined;
        pending(false);
      }
      throw error;
    }
    if (disposed) {
      try {
        clearInterval(nextTimer);
      } catch {
        // Owner disposal makes this unowned timer best-effort cleanup.
      }
      return;
    }
    if (currentGeneration === generation && pending()) {
      timer = nextTimer;
    }
  };

  const flush = () => {
    if (!disposed) {
      callback();
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    cancelTimer();
  });
  run();

  return {
    run,
    cancel,
    flush,
    pending
  };
}
