import {
  createThrottledFn,
  type ControlledFn,
  type Procedure,
  type ThrottleOptions
} from '../internal/timing';

export type UseThrottleFnOptions = ThrottleOptions;

/**
 * Throttled function wrapper with lifecycle-aware cleanup.
 *
 * @fictReturn {}
 */
export function useThrottleFn<T extends Procedure>(
  fn: T,
  wait: number,
  options: UseThrottleFnOptions = {}
): ControlledFn<T> {
  return createThrottledFn(fn, wait, options);
}
