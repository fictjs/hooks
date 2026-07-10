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
    const currentPermission = () => ({
      permission: activePermission.current,
      changed: false
    });
    if (disposed) {
      return currentPermission();
    }

    const nextPermission = readPermission();
    if (disposed) {
      return currentPermission();
    }
    const changed = !isSamePermission(activePermission.current, nextPermission);
    if (disposed) {
      return currentPermission();
    }
    if (changed) {
      const syncId = ++queryId;
      cleanup();
      if (disposed || syncId !== queryId) {
        return currentPermission();
      }
      activePermission.current = nextPermission;
      state(initialState);
    }
    return { permission: activePermission.current, changed };
  };

  const bindStatus = (
    nextStatus: PermissionStatus,
    statusPermission: PermissionDescriptor,
    statusQueryId: number
  ): boolean => {
    const ownsStatus = () => !disposed && statusQueryId === queryId;
    cleanup();
    if (!ownsStatus()) {
      return false;
    }

    const nextState = nextStatus.state;
    if (!ownsStatus()) {
      return false;
    }
    state(nextState);
    if (!ownsStatus()) {
      return false;
    }

    let changeGeneration = 0;
    let cleanupStatus = () => {};
    const onChange = () => {
      const changeId = ++changeGeneration;
      const ownsChange = () =>
        ownsStatus() && changeId === changeGeneration && cleanup === cleanupStatus;
      if (!ownsChange()) {
        return;
      }

      const currentPermission = readPermission();
      if (!ownsChange()) {
        return;
      }
      const matchesCurrentPermission = isSamePermission(statusPermission, currentPermission);
      if (!ownsChange() || !matchesCurrentPermission) {
        return;
      }
      const changedState = nextStatus.state;
      if (!ownsChange()) {
        return;
      }
      state(changedState);
      if (!ownsChange()) {
        return;
      }
    };

    let registrationComplete = false;
    let cleanupRequested = false;
    const removeListener = () => {
      nextStatus.removeEventListener('change', onChange as EventListener);
    };
    cleanupStatus = () => {
      changeGeneration += 1;
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
      return false;
    }

    return true;
  };

  const queryPermission = async (
    currentPermission: PermissionDescriptor
  ): Promise<PermissionStatus | null> => {
    if (disposed) {
      return null;
    }

    const permissions = navigatorRef?.permissions;
    if (disposed) {
      return null;
    }
    const queryStatus = permissions?.query;
    if (disposed) {
      return null;
    }

    if (typeof queryStatus !== 'function') {
      isSupported(false);
      return null;
    }

    const currentQueryId = ++queryId;

    isSupported(true);
    if (disposed || currentQueryId !== queryId) {
      return null;
    }

    try {
      const nextStatus = await queryStatus.call(permissions, currentPermission);
      if (disposed || currentQueryId !== queryId) {
        return null;
      }
      if (!bindStatus(nextStatus, currentPermission, currentQueryId)) {
        return null;
      }
      if (disposed || currentQueryId !== queryId) {
        return null;
      }
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
