import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
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
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface UseWebSocketReturn<TIncoming = unknown, TOutgoing = SerializablePayload> {
  data: () => TIncoming | null;
  error: () => Event | null;
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
  const webSocketCtor =
    options.webSocket === undefined
      ? (windowSocketCtor ?? (globalThis.WebSocket as WebSocketConstructor | undefined))
      : options.webSocket;
  const reconnectOptions = normalizeReconnectOptions(options.autoReconnect);

  const data = createSignal<TIncoming | null>(options.initialData ?? null);
  const error = createSignal<Event | null>(null);
  const status = createSignal<WebSocketStatus>('CLOSED');
  const isSupported = createSignal(!!webSocketCtor);
  const reconnectCount = createSignal(0);

  const serialize =
    options.serialize ??
    ((payload: TOutgoing): SerializablePayload => payload as unknown as SerializablePayload);
  const deserialize =
    options.deserialize ?? ((event: MessageEvent): TIncoming => event.data as TIncoming);

  let socket: WebSocketLike | null = null;
  let manuallyClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let cleanupSocket = () => {};

  const stopReconnectTimer = () => {
    if (reconnectTimer == null) {
      return;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const resetReconnectAttempts = () => {
    reconnectAttempts = 0;
    reconnectCount(0);
  };

  const scheduleReconnect = () => {
    if (!reconnectOptions) {
      return;
    }

    const retries = reconnectOptions.retries ?? Infinity;
    if (reconnectAttempts >= retries) {
      return;
    }

    reconnectAttempts += 1;
    reconnectCount(reconnectAttempts);

    const delayValue = reconnectOptions.delay ?? 1000;
    const delay = typeof delayValue === 'function' ? delayValue(reconnectAttempts) : delayValue;
    stopReconnectTimer();
    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = null;
        open();
      },
      Math.max(0, delay)
    );
  };

  const open = (): boolean => {
    const resolvedUrl = toValue(url);
    if (!webSocketCtor || !resolvedUrl) {
      isSupported(false);
      return false;
    }

    if (socket && (socket.readyState === socket.CONNECTING || socket.readyState === socket.OPEN)) {
      return true;
    }

    stopReconnectTimer();
    manuallyClosed = false;
    error(null);

    let currentSocket: WebSocketLike;
    try {
      currentSocket = new webSocketCtor(resolvedUrl, options.protocols);
    } catch (nextError) {
      error(nextError as Event);
      status('CLOSED');
      scheduleReconnect();
      return false;
    }

    socket = currentSocket;
    status(toStatus(currentSocket.readyState, currentSocket));

    if (options.binaryType) {
      currentSocket.binaryType = options.binaryType;
    }

    const onOpen = (event: Event) => {
      if (socket !== currentSocket) {
        return;
      }
      status('OPEN');
      resetReconnectAttempts();
      options.onOpen?.(event);
    };

    const onMessage = (event: Event) => {
      if (socket !== currentSocket) {
        return;
      }
      const messageEvent = event as MessageEvent;
      try {
        const nextData = deserialize(messageEvent);
        data(nextData);
        options.onMessage?.(nextData, messageEvent);
      } catch (nextError) {
        error(nextError as Event);
        options.onError?.(nextError as Event);
      }
    };

    const onError = (event: Event) => {
      if (socket !== currentSocket) {
        return;
      }
      error(event);
      options.onError?.(event);
    };

    const onClose = (event: Event) => {
      if (socket !== currentSocket) {
        return;
      }

      socket = null;
      cleanupSocket();
      status('CLOSED');
      options.onClose?.(event as CloseEvent);

      if (!manuallyClosed) {
        scheduleReconnect();
      }
    };

    currentSocket.addEventListener('open', onOpen as EventListener);
    currentSocket.addEventListener('message', onMessage as EventListener);
    currentSocket.addEventListener('error', onError as EventListener);
    currentSocket.addEventListener('close', onClose as EventListener);

    cleanupSocket = () => {
      currentSocket.removeEventListener('open', onOpen as EventListener);
      currentSocket.removeEventListener('message', onMessage as EventListener);
      currentSocket.removeEventListener('error', onError as EventListener);
      currentSocket.removeEventListener('close', onClose as EventListener);
      cleanupSocket = () => {};
    };

    return true;
  };

  const close = (code?: number, reason?: string) => {
    stopReconnectTimer();
    resetReconnectAttempts();
    manuallyClosed = true;

    const currentSocket = socket;
    if (!currentSocket) {
      status('CLOSED');
      return;
    }

    socket = null;
    cleanupSocket();
    status('CLOSING');
    currentSocket.close(code, reason);
    status('CLOSED');
  };

  const reconnect = () => {
    stopReconnectTimer();

    if (socket) {
      const currentSocket = socket;
      socket = null;
      cleanupSocket();
      manuallyClosed = true;
      currentSocket.close();
    }

    manuallyClosed = false;
    return open();
  };

  const send = (payload: TOutgoing): boolean => {
    const currentSocket = socket;
    if (!currentSocket || currentSocket.readyState !== currentSocket.OPEN) {
      return false;
    }

    try {
      currentSocket.send(serialize(payload));
      return true;
    } catch (nextError) {
      error(nextError as Event);
      return false;
    }
  };

  if (options.immediate ?? true) {
    open();
  }

  onDestroy(() => {
    stopReconnectTimer();
    close();
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
