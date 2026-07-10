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

  const cancel = () => {
    generation += 1;
    const currentTimer = timer;
    timer = undefined;
    pending(false);
    if (currentTimer !== undefined) {
      clearInterval(currentTimer);
    }
  };

  const run = () => {
    cancel();
    const wait = Math.max(0, toValue(interval as MaybeAccessor<number>));
    pending(true);
    const currentGeneration = ++generation;
    let nextTimer: ReturnType<typeof setInterval>;
    try {
      nextTimer = setInterval(() => {
        if (currentGeneration === generation) {
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
    if (currentGeneration === generation && pending()) {
      timer = nextTimer;
    }
  };

  const flush = () => {
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
