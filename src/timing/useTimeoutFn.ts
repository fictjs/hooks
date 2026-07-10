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
  let operationGeneration = 0;

  const ownsOperation = (operation: number) => operation === operationGeneration;

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
    const wait = Math.max(0, toValue(delay as MaybeAccessor<number>));
    if (disposed || !ownsOperation(operation)) {
      return;
    }

    pending(true);
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    const currentGeneration = ++generation;
    let nextTimer: ReturnType<typeof setTimeout>;
    let firedSynchronously = false;
    try {
      nextTimer = setTimeout(() => {
        if (disposed || currentGeneration !== generation) {
          return;
        }
        const callbackOperation = ++operationGeneration;
        firedSynchronously = true;
        timer = undefined;
        pending(false);
        if (!disposed && ownsOperation(callbackOperation)) {
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
    if (!ownsOperation(operation)) {
      if (!firedSynchronously) {
        try {
          clearTimeout(nextTimer);
        } catch {
          // A superseding operation owns the live timeout state.
        }
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
    const operation = ++operationGeneration;
    cancelTimer();
    if (!disposed && ownsOperation(operation)) {
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
