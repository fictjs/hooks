import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from './env';
import { tryOnDestroy } from './lifecycle';

export interface Serializer<T> {
  read: (raw: string) => T;
  write: (value: T) => string;
}

export interface UseStorageOptions<T> {
  window?: Window;
  listenToStorageChanges?: boolean;
  writeDefaults?: boolean;
  serializer?: Serializer<T>;
  onError?: (error: unknown) => void;
}

const syncEvent = 'fict-storage-sync';

interface StorageSyncDetail {
  key: string;
  value: string | null;
  storage: Storage;
}

const jsonSerializer: Serializer<unknown> = {
  read: (raw) => JSON.parse(raw),
  write: (value) => JSON.stringify(value)
};

function serializeValue<T>(serializer: Serializer<T>, value: T): string | undefined {
  const serialized = serializer.write(value);
  return typeof serialized === 'string' ? serialized : undefined;
}

function inferSerializer<T>(initial: T): Serializer<T> {
  const kind = typeof initial;

  if (kind === 'string') {
    return {
      read: (raw) => raw as T,
      write: (value) => String(value)
    };
  }

  if (kind === 'number') {
    return {
      read: (raw) => Number(raw) as T,
      write: (value) => String(value)
    };
  }

  if (kind === 'boolean') {
    return {
      read: (raw) => (raw === 'true') as T,
      write: (value) => String(value)
    };
  }

  if (initial instanceof Date) {
    return {
      read: (raw) => new Date(raw) as T,
      write: (value) => (value as Date).toISOString()
    };
  }

  if (initial instanceof Map) {
    return {
      read: (raw) => new Map(JSON.parse(raw) as [unknown, unknown][]) as T,
      write: (value) => JSON.stringify(Array.from((value as Map<unknown, unknown>).entries()))
    };
  }

  if (initial instanceof Set) {
    return {
      read: (raw) => new Set(JSON.parse(raw) as unknown[]) as T,
      write: (value) => JSON.stringify(Array.from((value as Set<unknown>).values()))
    };
  }

  return jsonSerializer as Serializer<T>;
}

export interface UseStorageReturn<T> {
  value: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  remove: () => void;
}

function safeCall(onError: ((error: unknown) => void) | undefined, error: unknown): void {
  if (!onError) {
    return;
  }
  onError(error);
}

function resolveNextValue<T>(next: T | ((prev: T) => T), prev: T): T {
  if (typeof next === 'function') {
    return (next as (prev: T) => T)(prev);
  }
  return next;
}

export function createStorageHook<T>(
  storage: Storage | undefined,
  key: string,
  initial: T,
  options: UseStorageOptions<T> = {}
): UseStorageReturn<T> {
  const windowRef = options.window ?? defaultWindow;
  const serializer = options.serializer ?? inferSerializer(initial);
  const emitSync = windowRef != null;

  const readStorage = (): T => {
    if (!storage) {
      return initial;
    }

    try {
      const raw = storage.getItem(key);
      if (raw == null) {
        if (options.writeDefaults ?? true) {
          const serializedInitial = serializeValue(serializer, initial);
          if (serializedInitial !== undefined) {
            storage.setItem(key, serializedInitial);
          }
        }
        return initial;
      }
      return serializer.read(raw);
    } catch (error) {
      safeCall(options.onError, error);
      return initial;
    }
  };

  const state = createSignal(readStorage());

  let paused = false;

  const writeState = (next: T) => {
    state(next);
  };

  const set = (next: T | ((prev: T) => T)) => {
    const prev = state();
    const value = resolveNextValue(next, prev);

    if (!storage) {
      writeState(value);
      return;
    }

    try {
      if (value === undefined) {
        paused = true;
        storage.removeItem(key);
        writeState(value);
        if (emitSync) {
          windowRef.dispatchEvent(
            new CustomEvent(syncEvent, {
              detail: {
                key,
                value: null,
                storage
              }
            })
          );
        }
        return;
      }

      const serialized = serializeValue(serializer, value);
      if (serialized === undefined) {
        paused = true;
        storage.removeItem(key);
        writeState(value);
        if (emitSync) {
          windowRef.dispatchEvent(
            new CustomEvent(syncEvent, {
              detail: {
                key,
                value: null,
                storage
              }
            })
          );
        }
        return;
      }

      const current = storage.getItem(key);
      if (current === serialized) {
        writeState(value);
        return;
      }

      paused = true;
      storage.setItem(key, serialized);
      writeState(value);
      if (emitSync) {
        windowRef.dispatchEvent(
          new CustomEvent(syncEvent, {
            detail: {
              key,
              value: serialized,
              storage
            }
          })
        );
      }
    } catch (error) {
      safeCall(options.onError, error);
    } finally {
      paused = false;
    }
  };

  const remove = () => {
    if (!storage) {
      writeState(initial);
      return;
    }

    try {
      paused = true;
      storage.removeItem(key);
      writeState(initial);
      if (emitSync) {
        windowRef.dispatchEvent(
          new CustomEvent(syncEvent, {
            detail: {
              key,
              value: null,
              storage
            }
          })
        );
      }
    } catch (error) {
      safeCall(options.onError, error);
    } finally {
      paused = false;
    }
  };

  const syncFromRaw = (raw: string | null) => {
    if (paused) {
      return;
    }

    if (raw == null) {
      state(initial);
      return;
    }

    try {
      state(serializer.read(raw));
    } catch (error) {
      safeCall(options.onError, error);
    }
  };

  const listenToStorageChanges = options.listenToStorageChanges ?? true;

  if (windowRef && storage && listenToStorageChanges) {
    const storageListener = (event: StorageEvent) => {
      if (event.storageArea !== storage || (event.key !== key && event.key !== null)) {
        return;
      }
      syncFromRaw(event.newValue);
    };

    const customListener = (event: Event) => {
      const custom = event as CustomEvent<StorageSyncDetail>;
      if (custom.detail?.storage !== storage || custom.detail.key !== key) {
        return;
      }
      syncFromRaw(custom.detail.value);
    };

    windowRef.addEventListener('storage', storageListener);
    windowRef.addEventListener(syncEvent, customListener);

    tryOnDestroy(() => {
      windowRef.removeEventListener('storage', storageListener);
      windowRef.removeEventListener(syncEvent, customListener);
    });
  }

  return {
    value: state,
    set,
    remove
  };
}
