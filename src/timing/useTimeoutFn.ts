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

  const cancel = () => {
    generation += 1;
    const currentTimer = timer;
    timer = undefined;
    pending(false);
    if (currentTimer !== undefined) {
      clearTimeout(currentTimer);
    }
  };

  const run = () => {
    cancel();
    const wait = Math.max(0, toValue(delay as MaybeAccessor<number>));

    pending(true);
    const currentGeneration = ++generation;
    let nextTimer: ReturnType<typeof setTimeout>;
    try {
      nextTimer = setTimeout(() => {
        if (currentGeneration !== generation) {
          return;
        }
        timer = undefined;
        pending(false);
        callback();
      }, wait);
    } catch (error) {
      if (currentGeneration === generation) {
        timer = undefined;
        pending(false);
      }
      throw error;
    }
    if (currentGeneration === generation && pending()) {
      timer = nextTimer;
    }
  };

  const flush = () => {
    if (!pending()) {
      return;
    }
    cancel();
    callback();
  };

  tryOnDestroy(cancel);
  run();

  return {
    run,
    cancel,
    flush,
    pending
  };
}
