import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultNavigator, defaultWindow } from '../internal/env';

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

  const update = () => {
    const nextConnection = resolveConnection(navigatorRef);

    online(navigatorRef?.onLine ?? true);
    downlink(nextConnection?.downlink ?? null);
    effectiveType(nextConnection?.effectiveType ?? null);
    rtt(nextConnection?.rtt ?? null);
    saveData(nextConnection?.saveData ?? false);
    type(nextConnection?.type ?? null);
  };

  useEventListener(windowRef, 'online', update, { passive: true });
  useEventListener(windowRef, 'offline', update, { passive: true });

  if (connection) {
    useEventListener(connection, 'change', update, { passive: true });
  }

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
