import { createRoot } from '@fictjs/runtime';
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
