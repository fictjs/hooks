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
  let operationGeneration = 0;

  const ownsOperation = (operation: number) => operation === operationGeneration;

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
      operationGeneration += 1;
      cancelTimer();
    }
  };

  const run = () => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    cancelTimer();
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    const wait = Math.max(0, toValue(interval as MaybeAccessor<number>));
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    pending(true);
    if (disposed || !ownsOperation(operation)) {
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
    if (!ownsOperation(operation)) {
      try {
        clearInterval(nextTimer);
      } catch {
        // A superseding operation owns the live interval state.
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
    operationGeneration += 1;
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
