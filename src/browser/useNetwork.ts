import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultNavigator, defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

interface NetworkConnectionLike extends EventTarget {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
}

export interface UseNetworkOptions {
  window?: Window | null;
  navigator?: NavigatorWithConnection | null;
}

export interface UseNetworkReturn {
  online: () => boolean;
  downlink: () => number | null;
  effectiveType: () => string | null;
  rtt: () => number | null;
  saveData: () => boolean;
  type: () => string | null;
  isSupported: () => boolean;
}

function resolveConnection(navigatorRef: NavigatorWithConnection | null | undefined) {
  return navigatorRef?.connection ?? navigatorRef?.mozConnection ?? navigatorRef?.webkitConnection;
}

/**
 * Reactive network status state.
 *
 * @fictReturn { online: 'signal', downlink: 'signal', effectiveType: 'signal', rtt: 'signal', saveData: 'signal', type: 'signal', isSupported: 'signal' }
 */
export function useNetwork(options: UseNetworkOptions = {}): UseNetworkReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const navigatorRef =
    options.navigator === undefined
      ? (defaultNavigator as NavigatorWithConnection | undefined)
      : options.navigator;
  const connection = resolveConnection(navigatorRef);

  const online = createSignal(navigatorRef?.onLine ?? true);
  const downlink = createSignal<number | null>(connection?.downlink ?? null);
  const effectiveType = createSignal<string | null>(connection?.effectiveType ?? null);
  const rtt = createSignal<number | null>(connection?.rtt ?? null);
  const saveData = createSignal<boolean>(connection?.saveData ?? false);
  const type = createSignal<string | null>(connection?.type ?? null);
  const isSupported = createSignal(navigatorRef != null);
  let updateGeneration = 0;
  let disposed = false;

  const update = () => {
    if (disposed) {
      return;
    }
    const currentGeneration = ++updateGeneration;
    const canCommit = () => !disposed && currentGeneration === updateGeneration;
    const nextConnection = resolveConnection(navigatorRef);
    if (!canCommit()) {
      return;
    }

    const nextOnline = navigatorRef?.onLine ?? true;
    if (!canCommit()) {
      return;
    }
    online(nextOnline);
    if (!canCommit()) {
      return;
    }

    const nextDownlink = nextConnection?.downlink ?? null;
    if (!canCommit()) {
      return;
    }
    downlink(nextDownlink);
    if (!canCommit()) {
      return;
    }

    const nextEffectiveType = nextConnection?.effectiveType ?? null;
    if (!canCommit()) {
      return;
    }
    effectiveType(nextEffectiveType);
    if (!canCommit()) {
      return;
    }

    const nextRtt = nextConnection?.rtt ?? null;
    if (!canCommit()) {
      return;
    }
    rtt(nextRtt);
    if (!canCommit()) {
      return;
    }

    const nextSaveData = nextConnection?.saveData ?? false;
    if (!canCommit()) {
      return;
    }
    saveData(nextSaveData);
    if (!canCommit()) {
      return;
    }

    const nextType = nextConnection?.type ?? null;
    if (!canCommit()) {
      return;
    }
    type(nextType);
  };

  useEventListener(windowRef, 'online', update, { passive: true });
  useEventListener(windowRef, 'offline', update, { passive: true });
  useEventListener(connection ?? null, 'change', update, { passive: true });

  tryOnDestroy(() => {
    disposed = true;
    updateGeneration += 1;
  });

  update();

  return {
    online,
    downlink,
    effectiveType,
    rtt,
    saveData,
    type,
    isSupported
  };
}
