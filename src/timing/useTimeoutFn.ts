import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface UseTimeoutFnControls {
  run: () => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

/**
 * Schedule a callback with timeout controls.
 *
 * @fictReturn { pending: 'signal' }
 */
export function useTimeoutFn(
  callback: () => void,
  delay: number | MaybeAccessor<number>
): UseTimeoutFnControls {
  const pending = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let disposed = false;

  const cancelTimer = () => {
    generation += 1;
    const currentTimer = timer;
    timer = undefined;
    pending(false);
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
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
    const wait = Math.max(0, toValue(delay as MaybeAccessor<number>));
    if (disposed) {
      return;
    }

    pending(true);
    if (disposed) {
      return;
    }
    const currentGeneration = ++generation;
    let nextTimer: ReturnType<typeof setTimeout>;
    try {
      nextTimer = setTimeout(() => {
        if (disposed || currentGeneration !== generation) {
          return;
        }
        timer = undefined;
        pending(false);
        if (!disposed) {
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
        clearTimeout(nextTimer);
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
    if (disposed || !pending()) {
      return;
    }
    cancel();
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
