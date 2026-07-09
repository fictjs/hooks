import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
  resolveStorageSafely,
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
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const storage = resolveStorageSafely(() => windowRef?.sessionStorage, options.onError);
  return createStorageHook(storage, key, initial, {
    ...options,
    window: windowRef
  });
}
