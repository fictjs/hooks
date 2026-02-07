import { createSignal } from '@fictjs/runtime/advanced';
import { onDestroy } from '@fictjs/runtime';
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

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    pending(false);
  };

  const run = () => {
    cancel();
    const wait = Math.max(0, toValue(delay as MaybeAccessor<number>));

    pending(true);
    timer = setTimeout(() => {
      timer = undefined;
      pending(false);
      callback();
    }, wait);
  };

  const flush = () => {
    if (!pending()) {
      return;
    }
    cancel();
    callback();
  };

  onDestroy(cancel);
  run();

  return {
    run,
    cancel,
    flush,
    pending
  };
}
