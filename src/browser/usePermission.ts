import { createEffect, onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultNavigator } from '../internal/env';
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

  let activePermission = normalizePermission(toValue(permission as MaybeAccessor<PermissionInput>));
  let cleanup = () => {};

  const bindStatus = (nextStatus: PermissionStatus) => {
    cleanup();
    state(nextStatus.state);

    const onChange = () => {
      state(nextStatus.state);
    };

    nextStatus.addEventListener('change', onChange as EventListener);
    cleanup = () => {
      nextStatus.removeEventListener('change', onChange as EventListener);
      cleanup = () => {};
    };
  };

  const query = async (): Promise<PermissionStatus | null> => {
    if (!navigatorRef?.permissions?.query) {
      isSupported(false);
      return null;
    }

    isSupported(true);

    try {
      const nextStatus = await navigatorRef.permissions.query(activePermission);
      bindStatus(nextStatus);
      return nextStatus;
    } catch {
      state(initialState);
      return null;
    }
  };

  createEffect(() => {
    activePermission = normalizePermission(toValue(permission as MaybeAccessor<PermissionInput>));
    if (options.immediate ?? true) {
      void query();
    }
  });

  onDestroy(() => {
    cleanup();
  });

  return {
    state,
    isSupported,
    query
  };
}
