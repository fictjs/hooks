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

  const cancel = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    pending(false);
  };

  const run = () => {
    cancel();
    const wait = Math.max(0, toValue(interval as MaybeAccessor<number>));
    pending(true);
    timer = setInterval(() => {
      callback();
    }, wait);
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
