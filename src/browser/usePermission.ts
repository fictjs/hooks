import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultNavigator } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
import { toValue, type MaybeAccessor } from '../internal/value';

interface PermissionNavigator {
  permissions?: {
    query: (permissionDesc: PermissionDescriptor) => Promise<PermissionStatus>;
  };
}

export type PermissionInput = PermissionDescriptor | string;

export interface UsePermissionOptions {
  navigator?: PermissionNavigator | null;
  initialState?: PermissionState;
  immediate?: boolean;
}

export interface UsePermissionReturn {
  state: () => PermissionState;
  isSupported: () => boolean;
  query: () => Promise<PermissionStatus | null>;
}

const permissionDescriptorKeys = [
  'name',
  'allowWithoutGesture',
  'allowWithoutSanitization',
  'deviceId',
  'panTiltZoom',
  'requestedOrigin',
  'sysex',
  'type',
  'userVisibleOnly'
] as const;

function normalizePermission(input: PermissionInput): PermissionDescriptor {
  if (typeof input === 'string') {
    return { name: input as PermissionName };
  }
  return input;
}

function isSamePermission(a: PermissionDescriptor, b: PermissionDescriptor): boolean {
  const keys = new Set([...permissionDescriptorKeys, ...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) =>
    Object.is(Reflect.get(a as object, key), Reflect.get(b as object, key))
  );
}

/**
 * Reactive Permissions API helper.
 *
 * @fictReturn { state: 'signal', isSupported: 'signal' }
 */
export function usePermission(
  permission: PermissionInput | MaybeAccessor<PermissionInput>,
  options: UsePermissionOptions = {}
): UsePermissionReturn {
  const navigatorRef =
    options.navigator === undefined
      ? (defaultNavigator as PermissionNavigator | undefined)
      : options.navigator;
  const initialState = options.initialState ?? 'prompt';
  const isSupported = createSignal<boolean>(!!navigatorRef?.permissions?.query);
  const state = createSignal<PermissionState>(initialState);

  const readPermission = () =>
    normalizePermission(toValue(permission as MaybeAccessor<PermissionInput>));
  const activePermission = { current: readPermission() };
  let initialized = false;
  let cleanup = () => {};
  let queryId = 0;
  let disposed = false;

  const syncPermission = () => {
    const nextPermission = readPermission();
    const changed = !isSamePermission(activePermission.current, nextPermission);
    if (changed) {
      queryId += 1;
      cleanup();
      activePermission.current = nextPermission;
      state(initialState);
    }
    return { permission: activePermission.current, changed };
  };

  const bindStatus = (
    nextStatus: PermissionStatus,
    statusPermission: PermissionDescriptor,
    statusQueryId: number
  ) => {
    const ownsStatus = () => !disposed && statusQueryId === queryId;
    cleanup();
    if (!ownsStatus()) {
      return;
    }
    state(nextStatus.state);
    if (!ownsStatus()) {
      return;
    }

    const onChange = () => {
      if (!ownsStatus()) {
        return;
      }

      const matchesCurrentPermission = isSamePermission(statusPermission, readPermission());
      if (ownsStatus() && matchesCurrentPermission) {
        state(nextStatus.state);
      }
    };

    let registrationComplete = false;
    let cleanupRequested = false;
    const removeListener = () => {
      nextStatus.removeEventListener('change', onChange as EventListener);
    };
    const cleanupStatus = () => {
      cleanupRequested = true;
      if (cleanup === cleanupStatus) {
        cleanup = () => {};
      }
      if (registrationComplete) {
        removeListener();
      }
    };
    cleanup = cleanupStatus;

    try {
      nextStatus.addEventListener('change', onChange as EventListener);
    } catch (error) {
      registrationComplete = true;
      if (cleanup === cleanupStatus) {
        cleanup = () => {};
      }
      try {
        removeListener();
      } catch {
        // Preserve the listener registration failure after best-effort rollback.
      }
      throw error;
    }

    registrationComplete = true;
    if (!ownsStatus() || cleanupRequested || cleanup !== cleanupStatus) {
      if (cleanup === cleanupStatus) {
        cleanup = () => {};
      }
      try {
        removeListener();
      } catch {
        // A terminal or superseded registration has no owner for cleanup failures.
      }
    }
  };

  const queryPermission = async (
    currentPermission: PermissionDescriptor
  ): Promise<PermissionStatus | null> => {
    if (disposed) {
      return null;
    }

    if (!navigatorRef?.permissions?.query) {
      isSupported(false);
      return null;
    }

    const currentQueryId = ++queryId;

    isSupported(true);

    try {
      const nextStatus = await navigatorRef.permissions.query(currentPermission);
      if (disposed || currentQueryId !== queryId) {
        return null;
      }
      bindStatus(nextStatus, currentPermission, currentQueryId);
      return nextStatus;
    } catch {
      if (currentQueryId === queryId) {
        state(initialState);
      }
      return null;
    }
  };

  const query = (): Promise<PermissionStatus | null> => {
    if (disposed) {
      return Promise.resolve(null);
    }
    const current = syncPermission();
    return queryPermission(current.permission);
  };

  createEffect(() => {
    const current = syncPermission();
    if (!initialized || current.changed) {
      initialized = true;
      if (options.immediate ?? true) {
        void queryPermission(current.permission);
      }
    }
  });

  tryOnDestroy(() => {
    disposed = true;
    queryId += 1;
    cleanup();
  });

  return {
    state,
    isSupported,
    query
  };
}
