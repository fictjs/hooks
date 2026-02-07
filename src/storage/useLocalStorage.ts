import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
  type UseStorageOptions,
  type UseStorageReturn
} from '../internal/storage';

/**
 * localStorage-backed state.
 *
 * @fictReturn { value: 'signal' }
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  options: UseStorageOptions<T> = {}
): UseStorageReturn<T> {
  const windowRef = options.window ?? defaultWindow;
  return createStorageHook(windowRef?.localStorage, key, initial, {
    ...options,
    window: windowRef
  });
}
