import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { toValue, type MaybeAccessor } from '../internal/value';

/**
 * Track the previous value of a reactive source.
 *
 * @fictReturn 'signal'
 */
export function usePrevious<T>(value: T | MaybeAccessor<T>): () => T | undefined {
  const previous = createSignal<T | undefined>(undefined);
  let lastValue: T | undefined;
  let initialized = false;

  createEffect(() => {
    const current = toValue(value as MaybeAccessor<T>);
    if (initialized) {
      previous(lastValue);
    }
    lastValue = current;
    initialized = true;
  });

  return previous;
}
