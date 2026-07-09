import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from '../../src/browser/useWebSocket';

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = MockWebSocket.CONNECTING;
  OPEN = MockWebSocket.OPEN;
  CLOSING = MockWebSocket.CLOSING;
  CLOSED = MockWebSocket.CLOSED;

  readonly url: string;
  readonly protocols?: string | string[];
  readyState = MockWebSocket.CONNECTING;
  binaryType: BinaryType = 'blob';

  readonly send = vi.fn((payload: unknown) => {
    this.sent.push(payload);
  });

  readonly close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSING;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(
      new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '', wasClean: true })
    );
  });

  readonly sent: unknown[] = [];

  constructor(url: string | URL, protocols?: string | string[]) {
    super();
    this.url = String(url);
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  serverClose(code = 1006, reason = 'abnormal close') {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code, reason, wasClean: false }));
  }

  fail() {
    this.dispatchEvent(new Event('error'));
  }
}

describe('useWebSocket', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it('connects and handles incoming messages', () => {
    const { value: state } = createRoot(() =>
      useWebSocket<{ value: number }>('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        deserialize: (event) => JSON.parse(String(event.data)) as { value: number }
      })
    );

    const socket = MockWebSocket.instances[0]!;
    expect(state.status()).toBe('CONNECTING');

    socket.open();
    expect(state.status()).toBe('OPEN');

    socket.message('{"value":1}');
    expect(state.data()).toEqual({ value: 1 });
  });

  it('captures deserialize errors instead of throwing globally', () => {
    const onError = vi.fn();
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        deserialize: () => {
          throw new Error('bad payload');
        },
        onError
      })
    );

    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.message('broken');

    const currentError = state.error() as unknown as Error;
    expect(currentError).toBeInstanceOf(Error);
    expect(currentError.message).toBe('bad payload');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('serializes outgoing payload with send', () => {
    const { value: state } = createRoot(() =>
      useWebSocket<{ ok: boolean }, { ok: boolean }>('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        serialize: (payload) => JSON.stringify(payload),
        immediate: false
      })
    );

    expect(state.send({ ok: true })).toBe(false);
    expect(state.open()).toBe(true);

    const socket = MockWebSocket.instances[0]!;
    socket.open();
    expect(state.send({ ok: true })).toBe(true);
    expect(socket.send).toHaveBeenCalledWith('{"ok":true}');
  });

  it('reports constructor errors through onError', () => {
    const onError = vi.fn();
    const connectError = new Error('connect failed');
    class ThrowingWebSocket {
      constructor() {
        throw connectError;
      }
    }

    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ThrowingWebSocket as never,
        onError,
        immediate: false
      })
    );

    expect(state.open()).toBe(false);
    expect(state.error()).toBe(connectError);
    expect(onError).toHaveBeenCalledWith(connectError);
  });

  it('reports send errors through onError', () => {
    const onError = vi.fn();
    const sendError = new Error('send failed');
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        onError
      })
    );
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.send.mockImplementationOnce(() => {
      throw sendError;
    });

    expect(state.send('payload')).toBe(false);
    expect(state.error()).toBe(sendError);
    expect(onError).toHaveBeenCalledWith(sendError);
  });

  it('auto reconnects on unexpected close', () => {
    vi.useFakeTimers();

    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        autoReconnect: { retries: 2, delay: 100 }
      })
    );

    const first = MockWebSocket.instances[0]!;
    first.serverClose();
    expect(state.reconnectCount()).toBe(1);

    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances).toHaveLength(2);

    const second = MockWebSocket.instances[1]!;
    second.serverClose();
    expect(state.reconnectCount()).toBe(2);

    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances).toHaveLength(3);

    const third = MockWebSocket.instances[2]!;
    third.serverClose();

    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('does not auto reconnect after manual close', () => {
    vi.useFakeTimers();

    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        autoReconnect: true
      })
    );

    const first = MockWebSocket.instances[0]!;
    state.close();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(state.status()).toBe('CLOSED');

    vi.advanceTimersByTime(2000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('calls onClose after manual close', () => {
    const onClose = vi.fn();
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        onClose
      })
    );

    state.close(1000, 'done');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose.mock.calls[0]?.[0]).toMatchObject({ code: 1000, reason: 'done' });
    expect(state.status()).toBe('CLOSED');
  });

  it('keeps ownership of the socket when close throws', () => {
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.close.mockImplementationOnce(() => {
      throw new Error('close failed');
    });

    state.close();

    expect(state.status()).toBe('OPEN');
    expect((state.error() as unknown as Error).message).toBe('close failed');
    expect(state.send('still-open')).toBe(true);

    state.close();
    expect(state.status()).toBe('CLOSED');
    expect(socket.close).toHaveBeenCalledTimes(2);
  });

  it('supports explicit reconnect', () => {
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );

    const first = MockWebSocket.instances[0]!;
    expect(state.reconnect()).toBe(true);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('returns false and keeps the current socket when reconnect close throws', () => {
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.close.mockImplementationOnce(() => {
      throw new Error('close failed');
    });

    expect(state.reconnect()).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(state.status()).toBe('OPEN');
    expect(state.send('still-open')).toBe(true);

    expect(state.reconnect()).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('cleans stale socket listeners when opening during closing', () => {
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const first = MockWebSocket.instances[0]!;
    const removeListener = vi.spyOn(first, 'removeEventListener');

    first.readyState = MockWebSocket.CLOSING;

    expect(state.open()).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(removeListener).toHaveBeenCalledTimes(4);
  });

  it('returns unsupported state when constructor is missing', () => {
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: null,
        window: null,
        immediate: false
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(state.open()).toBe(false);
  });

  it('does not use global WebSocket when window is explicitly null', () => {
    vi.stubGlobal('WebSocket', MockWebSocket);

    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        window: null,
        immediate: false
      })
    );

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(state.isSupported()).toBe(false);
    expect(state.open()).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('tracks an accessor url and opens when it becomes available', async () => {
    const source = createSignal<string | null>(null);
    const { value: state } = createRoot(() =>
      useWebSocket(() => source(), {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );

    expect(state.isSupported()).toBe(true);
    expect(state.status()).toBe('CLOSED');
    expect(MockWebSocket.instances).toHaveLength(0);

    source('ws://fict.test');
    await Promise.resolve();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.url).toBe('ws://fict.test');
    expect(state.status()).toBe('CONNECTING');
  });

  it('closes the active socket when accessor url becomes empty', async () => {
    const source = createSignal<string | null>('ws://fict.test');
    createRoot(() =>
      useWebSocket(() => source(), {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const socket = MockWebSocket.instances[0]!;

    source(null);
    await Promise.resolve();

    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it('reconnects when accessor url changes between non-empty values', async () => {
    const source = createSignal('ws://first.fict.test');
    const { value: state } = createRoot(() =>
      useWebSocket(() => source(), {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const first = MockWebSocket.instances[0]!;
    first.open();

    source('ws://second.fict.test');
    await Promise.resolve();

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.url).toBe('ws://second.fict.test');
    expect(state.status()).toBe('CONNECTING');
  });

  it('keeps the current socket when changing urls cannot close it', async () => {
    const source = createSignal('ws://first.fict.test');
    const { value: state } = createRoot(() =>
      useWebSocket(() => source(), {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );
    const first = MockWebSocket.instances[0]!;
    first.open();
    first.close.mockImplementationOnce(() => {
      throw new Error('close failed');
    });

    source('ws://second.fict.test');
    await Promise.resolve();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(state.status()).toBe('OPEN');
    expect(state.send('still-open')).toBe(true);
  });

  it('closes socket on dispose', () => {
    const { dispose } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket
      })
    );

    const socket = MockWebSocket.instances[0]!;
    dispose();
    expect(socket.close).toHaveBeenCalledTimes(1);
  });
});
