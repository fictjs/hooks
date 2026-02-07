# useWebSocket

## Purpose

Manage WebSocket connection state, messaging, and reconnect behavior reactively.

## API

```ts
function useWebSocket<
  TIncoming = unknown,
  TOutgoing = string | ArrayBufferLike | Blob | ArrayBufferView
>(
  url: string | URL | (() => string | URL | null | undefined),
  options?: {
    window?: Window | null;
    webSocket?: typeof WebSocket | null;
    protocols?: string | string[];
    immediate?: boolean;
    autoReconnect?: boolean | { retries?: number; delay?: number | ((attempt: number) => number) };
    binaryType?: BinaryType;
    initialData?: TIncoming | null;
    serialize?: (payload: TOutgoing) => string | ArrayBufferLike | Blob | ArrayBufferView;
    deserialize?: (event: MessageEvent) => TIncoming;
    onOpen?: (event: Event) => void;
    onMessage?: (data: TIncoming, event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
  }
): {
  data: () => TIncoming | null;
  error: () => Event | null;
  status: () => 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';
  isSupported: () => boolean;
  reconnectCount: () => number;
  open: () => boolean;
  close: (code?: number, reason?: string) => void;
  reconnect: () => boolean;
  send: (payload: TOutgoing) => boolean;
};
```

## Notes

- `autoReconnect` supports retry count and custom retry delay strategy.
- `send()` returns `false` when connection is not `OPEN`.
