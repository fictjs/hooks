import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
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
  let disposed = false;
  let operationGeneration = 0;

  createEffect(() => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    const current = toValue(value as MaybeAccessor<T>);
    if (disposed || operation !== operationGeneration) {
      return;
    }
    if (initialized) {
      previous(lastValue);
      if (disposed || operation !== operationGeneration) {
        return;
      }
    }
    lastValue = current;
    initialized = true;
  });

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
  });

  return previous;
}
