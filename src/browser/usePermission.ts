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

function normalizePermission(input: PermissionInput): PermissionDescriptor {
  if (typeof input === 'string') {
    return { name: input as PermissionName };
  }
  return input;
}

function isSamePermission(a: PermissionDescriptor, b: PermissionDescriptor): boolean {
  const aRecord = a as unknown as Record<string, unknown>;
  const bRecord = b as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)]);
  return [...keys].every((key) => Object.is(aRecord[key], bRecord[key]));
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
    }
    return { permission: activePermission.current, changed };
  };

  const bindStatus = (nextStatus: PermissionStatus) => {
    cleanup();
    state(nextStatus.state);

    const onChange = () => {
      if (!disposed) {
        state(nextStatus.state);
      }
    };

    nextStatus.addEventListener('change', onChange as EventListener);
    cleanup = () => {
      nextStatus.removeEventListener('change', onChange as EventListener);
      cleanup = () => {};
    };
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
      bindStatus(nextStatus);
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
