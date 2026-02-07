import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
  type UseStorageOptions,
  type UseStorageReturn
} from '../internal/storage';

/**
 * sessionStorage-backed state.
 *
 * @fictReturn { value: 'signal' }
 */
export function useSessionStorage<T>(
  key: string,
  initial: T,
  options: UseStorageOptions<T> = {}
): UseStorageReturn<T> {
  const windowRef = options.window ?? defaultWindow;
  return createStorageHook(windowRef?.sessionStorage, key, initial, {
    ...options,
    window: windowRef
  });
}
