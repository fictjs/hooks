import {
  createDebouncedFn,
  type ControlledFn,
  type DebounceOptions,
  type Procedure
} from '../internal/timing';

export type UseDebounceFnOptions = DebounceOptions;

/**
 * Debounced function wrapper with lifecycle-aware cleanup.
 *
 * @fictReturn {}
 */
export function useDebounceFn<T extends Procedure>(
  fn: T,
  wait: number,
  options: UseDebounceFnOptions = {}
): ControlledFn<T> {
  return createDebouncedFn(fn, wait, options);
}
