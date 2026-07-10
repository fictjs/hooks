'use fict-compiler-disable';

import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from './env';
import { tryOnDestroy } from './lifecycle';

export interface Serializer<T> {
  read: (raw: string) => T;
  write: (value: T) => string;
}

export interface UseStorageOptions<T> {
  window?: Window | null;
  listenToStorageChanges?: boolean;
  writeDefaults?: boolean;
  serializer?: Serializer<T>;
  onError?: (error: unknown) => void;
}

export interface WritableStorageAccessor<T> {
  (next: T | ((prev: T) => T)): void;
  (): T;
}

export function resolveStorageSafely(
  resolve: () => Storage | null | undefined,
  onError?: (error: unknown) => void
): Storage | undefined {
  try {
    return resolve() ?? undefined;
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}

const syncEvent = 'fict-storage-sync';

interface StorageSyncDetail {
  key: string;
  value: string | null;
  storage: Storage;
}

type WindowWithCustomEvent = Window & {
  CustomEvent?: typeof CustomEvent;
};

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
  value: WritableStorageAccessor<T>;
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
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const serializer = options.serializer ?? inferSerializer(initial);
  const CustomEventCtor =
    (windowRef as WindowWithCustomEvent | null)?.CustomEvent ??
    (typeof globalThis.CustomEvent === 'function' ? globalThis.CustomEvent : undefined);

  const dispatchSync = (value: string | null) => {
    if (!windowRef || !storage || !CustomEventCtor) {
      return;
    }

    windowRef.dispatchEvent(
      new CustomEventCtor(syncEvent, {
        detail: {
          key,
          value,
          storage
        }
      })
    );
  };

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
  let syncGeneration = 0;
  let operationGeneration = 0;
  let disposed = false;

  const ownsOperation = (operation: number) => !disposed && operation === operationGeneration;

  const writeState = (next: T) => {
    syncGeneration += 1;
    state(next);
  };

  const set = (next: T | ((prev: T) => T)) => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    const prev = state();
    if (!ownsOperation(operation)) {
      return;
    }
    const value = resolveNextValue(next, prev);
    if (!ownsOperation(operation)) {
      return;
    }

    if (value === undefined) {
      if (!storage) {
        writeState(initial);
        return;
      }
      try {
        paused = true;
        storage.removeItem(key);
        if (!ownsOperation(operation)) {
          return;
        }
        writeState(initial);
        if (!ownsOperation(operation)) {
          return;
        }
        dispatchSync(null);
        return;
      } catch (error) {
        if (ownsOperation(operation)) {
          safeCall(options.onError, error);
        }
        return;
      } finally {
        paused = false;
      }
    }

    if (!storage) {
      writeState(value);
      return;
    }

    try {
      const serialized = serializeValue(serializer, value);
      if (!ownsOperation(operation)) {
        return;
      }
      if (serialized === undefined) {
        paused = true;
        storage.removeItem(key);
        if (!ownsOperation(operation)) {
          return;
        }
        writeState(initial);
        if (!ownsOperation(operation)) {
          return;
        }
        dispatchSync(null);
        return;
      }

      const current = storage.getItem(key);
      if (!ownsOperation(operation)) {
        return;
      }
      if (current === serialized) {
        paused = true;
        writeState(value);
        if (!ownsOperation(operation)) {
          return;
        }
        dispatchSync(serialized);
        return;
      }

      paused = true;
      storage.setItem(key, serialized);
      if (!ownsOperation(operation)) {
        return;
      }
      writeState(value);
      if (!ownsOperation(operation)) {
        return;
      }
      dispatchSync(serialized);
    } catch (error) {
      if (ownsOperation(operation)) {
        safeCall(options.onError, error);
      }
    } finally {
      paused = false;
    }
  };

  const remove = () => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    if (!storage) {
      writeState(initial);
      return;
    }

    try {
      paused = true;
      storage.removeItem(key);
      if (!ownsOperation(operation)) {
        return;
      }
      writeState(initial);
      if (!ownsOperation(operation)) {
        return;
      }
      dispatchSync(null);
    } catch (error) {
      if (ownsOperation(operation)) {
        safeCall(options.onError, error);
      }
    } finally {
      paused = false;
    }
  };

  const applySyncedRaw = (raw: string | null, generation: number) => {
    if (raw == null) {
      if (generation === syncGeneration) {
        state(initial);
      }
      return;
    }

    const value = serializer.read(raw);
    if (generation === syncGeneration) {
      state(value);
    }
  };

  const syncFromRaw = (raw: string | null) => {
    if (disposed || paused) {
      return;
    }

    const generation = ++syncGeneration;

    try {
      applySyncedRaw(raw, generation);
    } catch (error) {
      safeCall(options.onError, error);
    }
  };

  const syncFromStorage = () => {
    if (disposed || paused || !storage) {
      return;
    }

    const generation = ++syncGeneration;
    try {
      applySyncedRaw(storage.getItem(key), generation);
    } catch (error) {
      safeCall(options.onError, error);
    }
  };

  const listenToStorageChanges = options.listenToStorageChanges ?? true;

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
    syncGeneration += 1;
  });

  if (windowRef && storage && listenToStorageChanges) {
    const storageListener = (event: StorageEvent) => {
      if (disposed || !listening) {
        return;
      }
      const storageArea = event.storageArea;
      if (disposed || !listening || storageArea !== storage) {
        return;
      }
      const eventKey = event.key;
      if (disposed || !listening || (eventKey !== key && eventKey !== null)) {
        return;
      }
      const newValue = event.newValue;
      if (disposed || !listening) {
        return;
      }
      syncFromRaw(newValue);
    };

    const customListener = (event: Event) => {
      if (disposed || !listening) {
        return;
      }
      const custom = event as CustomEvent<StorageSyncDetail>;
      const detail = custom.detail;
      if (disposed || !listening || !detail) {
        return;
      }
      const detailStorage = detail.storage;
      if (disposed || !listening || detailStorage !== storage) {
        return;
      }
      const detailKey = detail.key;
      if (disposed || !listening || detailKey !== key) {
        return;
      }
      syncFromStorage();
    };

    let listening = true;
    let storageRegistered = false;
    let syncRegistered = false;

    const cleanupListeners = () => {
      listening = false;
      const removeStorage = storageRegistered;
      const removeSync = syncRegistered;
      storageRegistered = false;
      syncRegistered = false;

      let cleanupFailed = false;
      let cleanupError: unknown;
      if (removeStorage) {
        try {
          windowRef.removeEventListener('storage', storageListener);
        } catch (error) {
          cleanupFailed = true;
          cleanupError = error;
        }
      }
      if (removeSync) {
        try {
          windowRef.removeEventListener(syncEvent, customListener);
        } catch (error) {
          if (!cleanupFailed) {
            cleanupFailed = true;
            cleanupError = error;
          }
        }
      }
      if (cleanupFailed) {
        throw cleanupError;
      }
    };

    tryOnDestroy(() => {
      disposed = true;
      cleanupListeners();
    });

    try {
      storageRegistered = true;
      windowRef.addEventListener('storage', storageListener);
      storageRegistered = true;

      if (!disposed) {
        syncRegistered = true;
        windowRef.addEventListener(syncEvent, customListener);
        syncRegistered = true;
      }

      if (disposed) {
        try {
          cleanupListeners();
        } catch {
          // Owner disposal already completed; cleanup remains best-effort.
        }
      }
    } catch (error) {
      try {
        cleanupListeners();
      } catch {
        // Preserve the listener setup failure after best-effort rollback.
      }
      throw error;
    }
  }

  const value = function value(next?: T | ((prev: T) => T)) {
    if (arguments.length === 0) {
      return state();
    }
    set(next as T | ((prev: T) => T));
  } as WritableStorageAccessor<T>;

  return {
    value,
    set,
    remove
  };
}
