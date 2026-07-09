import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
  resolveStorageSafely,
  type Serializer,
  type UseStorageOptions,
  type UseStorageReturn
} from '../internal/storage';

export interface UseStorageHookOptions<T> extends UseStorageOptions<T> {
  storage?: Storage | null;
}

/**
 * Generic storage-backed state.
 *
 * @fictReturn { value: 'signal' }
 */
export function useStorage<T>(
  key: string,
  initial: T,
  options: UseStorageHookOptions<T> = {}
): UseStorageReturn<T> {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const storage =
    options.storage === undefined
      ? resolveStorageSafely(() => windowRef?.localStorage, options.onError)
      : options.storage;

  return createStorageHook(storage ?? undefined, key, initial, {
    window: windowRef,
    serializer: options.serializer as Serializer<T> | undefined,
    onError: options.onError,
    listenToStorageChanges: options.listenToStorageChanges,
    writeDefaults: options.writeDefaults
  });
}
