import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
  resolveStorageSafely,
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
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const storage = resolveStorageSafely(() => windowRef?.localStorage, options.onError);
  return createStorageHook(storage, key, initial, {
    ...options,
    window: windowRef
  });
}
