import { defaultWindow } from '../internal/env';
import {
  createStorageHook,
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
  const windowRef = options.window ?? defaultWindow;
  const storage = options.storage === undefined ? windowRef?.localStorage : options.storage;

  return createStorageHook(storage ?? undefined, key, initial, {
    window: windowRef,
    serializer: options.serializer as Serializer<T> | undefined,
    onError: options.onError,
    listenToStorageChanges: options.listenToStorageChanges,
    writeDefaults: options.writeDefaults
  });
}
