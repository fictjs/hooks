import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
import { toValue, type MaybeAccessor } from '../internal/value';

export type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

export interface UseWebSocketReconnectOptions {
  retries?: number;
  delay?: number | ((attempt: number) => number);
}

type SerializablePayload = string | ArrayBufferLike | Blob | ArrayBufferView;
type WebSocketLike = Pick<
  WebSocket,
  | 'addEventListener'
  | 'removeEventListener'
  | 'send'
  | 'close'
  | 'readyState'
  | 'binaryType'
  | 'OPEN'
  | 'CONNECTING'
  | 'CLOSING'
  | 'CLOSED'
>;

type WebSocketConstructor = new (url: string | URL, protocols?: string | string[]) => WebSocketLike;

export interface UseWebSocketOptions<TIncoming = unknown, TOutgoing = SerializablePayload> {
  window?: Window | null;
  webSocket?: WebSocketConstructor | null;
  protocols?: string | string[];
  immediate?: boolean;
  autoReconnect?: boolean | UseWebSocketReconnectOptions;
  binaryType?: BinaryType;
  initialData?: TIncoming | null;
  serialize?: (payload: TOutgoing) => SerializablePayload;
  deserialize?: (event: MessageEvent) => TIncoming;
  onOpen?: (event: Event) => void;
  onMessage?: (data: TIncoming, event: MessageEvent) => void;
  onError?: (error: unknown) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface UseWebSocketReturn<TIncoming = unknown, TOutgoing = SerializablePayload> {
  data: () => TIncoming | null;
  error: () => unknown;
  status: () => WebSocketStatus;
  isSupported: () => boolean;
  reconnectCount: () => number;
  open: () => boolean;
  close: (code?: number, reason?: string) => void;
  reconnect: () => boolean;
  send: (payload: TOutgoing) => boolean;
}

function normalizeReconnectOptions(
  value: boolean | UseWebSocketReconnectOptions | undefined
): UseWebSocketReconnectOptions | null {
  if (!value) {
    return null;
  }
  if (value === true) {
    return { retries: Infinity, delay: 1000 };
  }
  return {
    retries: value.retries ?? Infinity,
    delay: value.delay ?? 1000
  };
}

function toStatus(value: number, socket: WebSocketLike): WebSocketStatus {
  switch (value) {
    case socket.CONNECTING:
      return 'CONNECTING';
    case socket.OPEN:
      return 'OPEN';
    case socket.CLOSING:
      return 'CLOSING';
    default:
      return 'CLOSED';
  }
}

/**
 * Reactive WebSocket connection helper.
 *
 * @fictReturn { data: 'signal', error: 'signal', status: 'signal', isSupported: 'signal', reconnectCount: 'signal' }
 */
export function useWebSocket<TIncoming = unknown, TOutgoing = SerializablePayload>(
  url: MaybeAccessor<string | URL | null | undefined>,
  options: UseWebSocketOptions<TIncoming, TOutgoing> = {}
): UseWebSocketReturn<TIncoming, TOutgoing> {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const windowSocketCtor = (windowRef as (Window & { WebSocket?: WebSocketConstructor }) | null)
    ?.WebSocket;
  const webSocketCtor = options.webSocket === undefined ? windowSocketCtor : options.webSocket;
  const reconnectOptions = normalizeReconnectOptions(options.autoReconnect);

  const data = createSignal<TIncoming | null>(options.initialData ?? null);
  const error = createSignal<unknown>(null);
  const status = createSignal<WebSocketStatus>('CLOSED');
  const isSupported = createSignal(!!webSocketCtor);
  const reconnectCount = createSignal(0);

  const serialize =
    options.serialize ??
    ((payload: TOutgoing): SerializablePayload => payload as unknown as SerializablePayload);
  const deserialize =
    options.deserialize ?? ((event: MessageEvent): TIncoming => event.data as TIncoming);

  let socket: WebSocketLike | null = null;
  let socketUrlKey: string | null = null;
  let manuallyClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimerEpoch = 0;
  let reconnectAttempts = 0;
  let cleanupSocket = () => {};
  let destroyed = false;
  let operationEpoch = 0;

  const hasOwnedSocket = () => socket !== null;

  const reportError = (nextError: unknown) => {
    error(nextError);
    if (destroyed) {
      return;
    }
    try {
      options.onError?.(nextError);
    } catch {
      // User callbacks must not interrupt socket recovery or control contracts.
    }
  };

  const stopReconnectTimer = () => {
    const currentTimer = reconnectTimer;
    reconnectTimer = null;
    reconnectTimerEpoch += 1;
    if (currentTimer == null) {
      return;
    }
    clearTimeout(currentTimer);
  };

  const resetReconnectAttempts = () => {
    reconnectAttempts = 0;
    reconnectCount(0);
  };

  const scheduleReconnect = () => {
    if (destroyed || !reconnectOptions) {
      return;
    }

    const scheduleOperation = operationEpoch;
    stopReconnectTimer();
    if (destroyed || manuallyClosed || socket !== null || scheduleOperation !== operationEpoch) {
      return;
    }
    const scheduleEpoch = ++reconnectTimerEpoch;

    const retries = reconnectOptions.retries ?? Infinity;
    if (reconnectAttempts >= retries) {
      return;
    }

    reconnectAttempts += 1;
    reconnectCount(reconnectAttempts);
    if (
      destroyed ||
      manuallyClosed ||
      socket !== null ||
      scheduleOperation !== operationEpoch ||
      scheduleEpoch !== reconnectTimerEpoch
    ) {
      return;
    }

    const delayValue = reconnectOptions.delay ?? 1000;
    const delay = typeof delayValue === 'function' ? delayValue(reconnectAttempts) : delayValue;
    if (
      destroyed ||
      manuallyClosed ||
      socket !== null ||
      scheduleOperation !== operationEpoch ||
      scheduleEpoch !== reconnectTimerEpoch
    ) {
      return;
    }

    let firedSynchronously = false;
    const handleReconnect = () => {
      if (
        destroyed ||
        manuallyClosed ||
        socket !== null ||
        scheduleOperation !== operationEpoch ||
        scheduleEpoch !== reconnectTimerEpoch
      ) {
        return;
      }
      firedSynchronously = true;
      reconnectTimer = null;
      reconnectTimerEpoch += 1;
      open();
    };
    const timer = setTimeout(handleReconnect, Math.max(0, delay));
    if (firedSynchronously) {
      return;
    }
    if (
      destroyed ||
      manuallyClosed ||
      socket !== null ||
      scheduleOperation !== operationEpoch ||
      scheduleEpoch !== reconnectTimerEpoch
    ) {
      clearTimeout(timer);
      return;
    }
    reconnectTimer = timer;
  };

  const closeSocketForReplacement = (currentSocket: WebSocketLike): boolean => {
    const previousManuallyClosed = manuallyClosed;
    manuallyClosed = true;

    try {
      currentSocket.close();
    } catch (nextError) {
      manuallyClosed = previousManuallyClosed;
      if (socket === currentSocket) {
        status(toStatus(currentSocket.readyState, currentSocket));
      }
      reportError(nextError);
      return false;
    }

    if (socket === currentSocket) {
      socket = null;
      socketUrlKey = null;
      cleanupSocket();
    }
    return true;
  };

  const open = (): boolean => {
    if (destroyed) {
      return false;
    }
    const currentOperation = ++operationEpoch;

    const resolvedUrl = toValue(url);
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }
    if (!webSocketCtor) {
      isSupported(false);
      return false;
    }
    isSupported(true);
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }
    if (!resolvedUrl) {
      stopReconnectTimer();
      if (socket) {
        close();
      } else {
        status('CLOSED');
      }
      return false;
    }
    const nextUrlKey = String(resolvedUrl);
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }

    const existingSocket = socket;
    const existingReadyState = existingSocket?.readyState;
    if (destroyed || currentOperation !== operationEpoch || socket !== existingSocket) {
      return hasOwnedSocket();
    }
    const existingConnectingState = existingSocket?.CONNECTING;
    if (destroyed || currentOperation !== operationEpoch || socket !== existingSocket) {
      return hasOwnedSocket();
    }
    const existingOpenState = existingSocket?.OPEN;
    if (destroyed || currentOperation !== operationEpoch || socket !== existingSocket) {
      return hasOwnedSocket();
    }

    if (
      existingSocket &&
      (existingReadyState === existingConnectingState || existingReadyState === existingOpenState)
    ) {
      if (socketUrlKey === nextUrlKey) {
        return true;
      }

      if (!closeSocketForReplacement(existingSocket)) {
        return false;
      }
      if (destroyed || currentOperation !== operationEpoch) {
        return hasOwnedSocket();
      }
    }
    if (socket) {
      socket = null;
      socketUrlKey = null;
      cleanupSocket();
      if (destroyed || currentOperation !== operationEpoch) {
        return hasOwnedSocket();
      }
    }

    stopReconnectTimer();
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }
    manuallyClosed = false;
    error(null);
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }

    let currentSocket: WebSocketLike;
    try {
      currentSocket = new webSocketCtor(resolvedUrl, options.protocols);
    } catch (nextError) {
      reportError(nextError);
      if (destroyed || currentOperation !== operationEpoch) {
        return hasOwnedSocket();
      }
      status('CLOSED');
      scheduleReconnect();
      return false;
    }

    if (destroyed || currentOperation !== operationEpoch) {
      try {
        currentSocket.close();
      } catch {
        // A stale constructor result has no owner to receive cleanup failures.
      }
      return hasOwnedSocket();
    }

    socket = currentSocket;
    socketUrlKey = nextUrlKey;
    status(toStatus(currentSocket.readyState, currentSocket));
    const ownsSocketSetup = () =>
      !destroyed && !manuallyClosed && socket === currentSocket;
    if (!ownsSocketSetup()) {
      return hasOwnedSocket();
    }

    const onOpen = (event: Event) => {
      if (destroyed || socket !== currentSocket) {
        return;
      }
      status('OPEN');
      if (destroyed || socket !== currentSocket) {
        return;
      }
      resetReconnectAttempts();
      if (destroyed || socket !== currentSocket) {
        return;
      }
      options.onOpen?.(event);
    };

    const onMessage = (event: Event) => {
      if (destroyed || socket !== currentSocket) {
        return;
      }
      const messageEvent = event as MessageEvent;
      try {
        const nextData = deserialize(messageEvent);
        if (destroyed || socket !== currentSocket) {
          return;
        }
        data(nextData);
        if (destroyed || socket !== currentSocket) {
          return;
        }
        options.onMessage?.(nextData, messageEvent);
      } catch (nextError) {
        if (!destroyed && socket === currentSocket) {
          reportError(nextError);
        }
      }
    };

    const onError = (event: Event) => {
      if (destroyed || socket !== currentSocket) {
        return;
      }
      reportError(event);
    };

    const onClose = (event: Event) => {
      if (destroyed || socket !== currentSocket) {
        return;
      }
      const closeOperation = operationEpoch;

      socket = null;
      socketUrlKey = null;
      cleanupSocket();
      if (destroyed || socket !== null || closeOperation !== operationEpoch) {
        return;
      }
      status('CLOSED');
      if (destroyed || socket !== null || closeOperation !== operationEpoch) {
        return;
      }
      try {
        options.onClose?.(event as CloseEvent);
      } catch (nextError) {
        reportError(nextError);
      } finally {
        if (!destroyed && !manuallyClosed && socket == null && reconnectTimer == null) {
          scheduleReconnect();
        }
      }
    };

    const registrations: Array<{ type: string; listener: EventListener }> = [];
    const removeRegistrations = () => {
      for (const registration of registrations) {
        try {
          currentSocket.removeEventListener(registration.type, registration.listener);
        } catch {
          // Setup rollback is best-effort and must preserve the triggering operation.
        }
      }
    };
    const abandonInvalidSetup = () => {
      removeRegistrations();
      return hasOwnedSocket();
    };

    try {
      const binaryType = options.binaryType;
      if (!ownsSocketSetup()) {
        return abandonInvalidSetup();
      }
      if (binaryType) {
        currentSocket.binaryType = binaryType;
        if (!ownsSocketSetup()) {
          return abandonInvalidSetup();
        }
      }

      const listeners: Array<{ type: string; listener: EventListener }> = [
        { type: 'open', listener: onOpen as EventListener },
        { type: 'message', listener: onMessage as EventListener },
        { type: 'error', listener: onError as EventListener },
        { type: 'close', listener: onClose as EventListener }
      ];
      for (const registration of listeners) {
        registrations.push(registration);
        currentSocket.addEventListener(registration.type, registration.listener);
        if (!ownsSocketSetup()) {
          return abandonInvalidSetup();
        }
      }
    } catch (setupError) {
      removeRegistrations();
      if (socket === currentSocket) {
        socket = null;
        socketUrlKey = null;
        cleanupSocket = () => {};
        status('CLOSED');
        try {
          currentSocket.close();
        } catch {
          // Preserve the setup failure after best-effort socket rollback.
        }
      }
      throw setupError;
    }

    let cleaned = false;
    const cleanupCurrentSocket = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (cleanupSocket === cleanupCurrentSocket) {
        cleanupSocket = () => {};
      }
      for (const registration of registrations) {
        try {
          currentSocket.removeEventListener(registration.type, registration.listener);
        } catch {
          // Listener cleanup is terminal for this socket; continue removing the rest.
        }
      }
    };
    cleanupSocket = cleanupCurrentSocket;

    return true;
  };

  const close = (code?: number, reason?: string) => {
    if (destroyed) {
      return;
    }

    const currentOperation = ++operationEpoch;
    const ownsCloseOperation = () => !destroyed && currentOperation === operationEpoch;
    const previousManuallyClosed = manuallyClosed;
    const previousReconnectAttempts = reconnectAttempts;
    const previousReconnectCount = reconnectCount();
    stopReconnectTimer();
    if (!ownsCloseOperation()) {
      return;
    }
    resetReconnectAttempts();
    if (!ownsCloseOperation()) {
      return;
    }
    manuallyClosed = true;

    const currentSocket = socket;
    if (!currentSocket) {
      status('CLOSED');
      return;
    }

    status('CLOSING');
    if (!ownsCloseOperation() || socket !== currentSocket) {
      return;
    }
    try {
      currentSocket.close(code, reason);
    } catch (nextError) {
      if (!ownsCloseOperation() || socket !== currentSocket) {
        return;
      }
      manuallyClosed = previousManuallyClosed;
      reconnectAttempts = previousReconnectAttempts;
      reconnectCount(previousReconnectCount);
      if (!ownsCloseOperation() || socket !== currentSocket) {
        return;
      }
      const restoredStatus = toStatus(currentSocket.readyState, currentSocket);
      if (!ownsCloseOperation() || socket !== currentSocket) {
        return;
      }
      status(restoredStatus);
      if (!ownsCloseOperation() || socket !== currentSocket) {
        return;
      }
      reportError(nextError);
    }
  };

  const reconnect = () => {
    if (destroyed) {
      return false;
    }

    const currentOperation = ++operationEpoch;
    stopReconnectTimer();
    if (destroyed || currentOperation !== operationEpoch) {
      return hasOwnedSocket();
    }

    if (socket) {
      const currentSocket = socket;
      if (!closeSocketForReplacement(currentSocket)) {
        return false;
      }
      if (destroyed || currentOperation !== operationEpoch) {
        return hasOwnedSocket();
      }
    }

    manuallyClosed = false;
    return open();
  };

  const send = (payload: TOutgoing): boolean => {
    if (destroyed) {
      return false;
    }

    const currentSocket = socket;
    if (!currentSocket) {
      return false;
    }
    const initialReadyState = currentSocket.readyState;
    if (destroyed || manuallyClosed || socket !== currentSocket) {
      return false;
    }
    const initialOpenState = currentSocket.OPEN;
    if (destroyed || manuallyClosed || socket !== currentSocket) {
      return false;
    }
    if (initialReadyState !== initialOpenState) {
      return false;
    }

    try {
      const serialized = serialize(payload);
      if (destroyed || manuallyClosed || socket !== currentSocket) {
        return false;
      }
      const currentReadyState = currentSocket.readyState;
      if (destroyed || manuallyClosed || socket !== currentSocket) {
        return false;
      }
      const currentOpenState = currentSocket.OPEN;
      if (destroyed || manuallyClosed || socket !== currentSocket) {
        return false;
      }
      if (currentReadyState !== currentOpenState) {
        return false;
      }
      const sendCurrent = currentSocket.send;
      if (destroyed || manuallyClosed || socket !== currentSocket) {
        return false;
      }
      sendCurrent.call(currentSocket, serialized);
      return true;
    } catch (nextError) {
      if (!destroyed && socket === currentSocket) {
        reportError(nextError);
      }
      return false;
    }
  };

  const immediate = options.immediate ?? true;
  createEffect(() => {
    if (!immediate) {
      return;
    }

    const resolvedUrl = toValue(url);
    if (!resolvedUrl) {
      stopReconnectTimer();
      close();
      return;
    }
    open();
  });

  tryOnDestroy(() => {
    destroyed = true;
    operationEpoch += 1;
    stopReconnectTimer();
    manuallyClosed = true;
    resetReconnectAttempts();

    const currentSocket = socket;
    socket = null;
    socketUrlKey = null;
    cleanupSocket();
    status('CLOSED');

    try {
      currentSocket?.close();
    } catch {
      // Disposal is terminal: do not restore ownership or invoke user callbacks.
    }
  });

  return {
    data,
    error,
    status,
    isSupported,
    reconnectCount,
    open,
    close,
    reconnect,
    send
  };
}
