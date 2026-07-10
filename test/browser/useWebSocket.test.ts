import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
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

  it.each([
    ['status', 'OPEN'],
    ['reconnect count', 0]
  ])('does not call onOpen after the %s signal update disposes the owner', (_name, trigger) => {
    const onOpen = vi.fn();
    const reconnecting = trigger === 0;
    if (reconnecting) {
      vi.useFakeTimers();
    }
    let dispose = () => {};
    let triggered = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (!triggered && value === trigger) {
          triggered = true;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          autoReconnect: reconnecting ? { retries: 1, delay: 0 } : false,
          onOpen
        })
      );
      dispose = root.dispose;
      root.value.open();

      if (reconnecting) {
        MockWebSocket.instances[0]!.serverClose();
        vi.runAllTimers();
        MockWebSocket.instances[1]!.open();
      } else {
        MockWebSocket.instances[0]!.open();
      }

      expect(triggered).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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

  it('does not commit data after deserialize reconnects', () => {
    let reconnect = () => false;
    let armed = false;
    const onMessage = vi.fn();
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false,
        deserialize() {
          if (armed) {
            armed = false;
            reconnect();
          }
          return 'stale-message';
        },
        onMessage
      })
    );
    reconnect = root.value.reconnect;
    root.value.open();
    const oldSocket = MockWebSocket.instances[0]!;
    armed = true;

    oldSocket.message('payload');

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(root.value.data()).toBeNull();
    expect(onMessage).not.toHaveBeenCalled();
    expect(oldSocket.close).toHaveBeenCalledOnce();
    root.dispose();
  });

  it('does not commit data after deserialize disposes the owner', () => {
    let dispose = () => {};
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false,
        deserialize() {
          dispose();
          return 'terminal-message';
        }
      })
    );
    dispose = root.dispose;
    root.value.open();

    MockWebSocket.instances[0]!.message('payload');

    expect(root.value.data()).toBeNull();
    expect(root.value.status()).toBe('CLOSED');
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
  });

  it('does not call onMessage after the data signal update disposes the owner', () => {
    const onMessage = vi.fn();
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 'terminal-data') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          onMessage
        })
      );
      dispose = root.dispose;
      root.value.open();

      MockWebSocket.instances[0]!.message('terminal-data');

      expect(onMessage).not.toHaveBeenCalled();
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not call onError after the error signal update disposes the owner', () => {
    const onError = vi.fn();
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value instanceof Event && value.type === 'error') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          onError
        })
      );
      dispose = root.dispose;
      root.value.open();

      MockWebSocket.instances[0]!.fail();

      expect(onError).not.toHaveBeenCalled();
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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

  it('keeps reconnecting when constructor and error callback both throw', () => {
    vi.useFakeTimers();
    const connectError = new Error('connect failed');
    const onError = vi.fn(() => {
      throw new Error('error callback failed');
    });
    const constructor = vi.fn(() => {
      throw connectError;
    });
    const ThrowingWebSocket = function ThrowingWebSocket() {
      constructor();
    } as unknown as typeof WebSocket;
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ThrowingWebSocket,
        autoReconnect: { retries: 1, delay: 0 },
        onError,
        immediate: false
      })
    );

    expect(() => state.open()).not.toThrow();
    expect(state.reconnectCount()).toBe(1);
    expect(constructor).toHaveBeenCalledTimes(1);

    vi.runAllTimers();
    expect(constructor).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(state.error()).toBe(connectError);
  });

  it('preserves a socket opened reentrantly from a constructor error callback', () => {
    vi.useFakeTimers();
    const connectError = new Error('connect failed');
    let openReentrantly = () => false;
    let constructions = 0;
    let reentered = false;
    let reentrantOpenResult: boolean | undefined;
    const ReentrantWebSocket = function ReentrantWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      constructions += 1;
      if (constructions === 1) {
        throw connectError;
      }
      return new MockWebSocket(url, protocols);
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ReentrantWebSocket,
        autoReconnect: { retries: 1, delay: 0 },
        immediate: false,
        onError() {
          if (!reentered) {
            reentered = true;
            reentrantOpenResult = openReentrantly();
            MockWebSocket.instances[0]!.open();
          }
          throw new Error('error callback failed');
        }
      })
    );
    openReentrantly = root.value.open;

    expect(root.value.open()).toBe(true);

    expect(reentrantOpenResult).toBe(true);
    expect(constructions).toBe(2);
    expect(root.value.status()).toBe('OPEN');
    expect(root.value.error()).toBeNull();
    expect(root.value.reconnectCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(root.value.send('payload')).toBe(true);
    expect(MockWebSocket.instances[0]!.send).toHaveBeenCalledWith('payload');
    root.dispose();
  });

  it.each(['close', 'dispose'] as const)(
    'does not open after the url accessor reentrantly calls %s',
    (operation) => {
      let runOperation = () => {};
      let armed = false;
      const accessor = () => {
        if (armed) {
          armed = false;
          runOperation();
        }
        return 'ws://fict.test';
      };
      const root = createRoot(() =>
        useWebSocket<string, string>(accessor, {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false
        })
      );
      runOperation = operation === 'close' ? root.value.close : root.dispose;
      armed = true;

      expect(root.value.open()).toBe(false);
      expect(MockWebSocket.instances).toHaveLength(0);
      expect(root.value.status()).toBe('CLOSED');
    }
  );

  it('keeps a socket opened reentrantly from a successful constructor', () => {
    let openReentrantly = () => false;
    let constructions = 0;
    const ReentrantWebSocket = function ReentrantWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      constructions += 1;
      const currentSocket = new MockWebSocket(url, protocols);
      if (constructions === 1) {
        openReentrantly();
      }
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ReentrantWebSocket,
        immediate: false
      })
    );
    openReentrantly = root.value.open;

    expect(root.value.open()).toBe(true);

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
    expect(MockWebSocket.instances[1]!.close).not.toHaveBeenCalled();
    MockWebSocket.instances[1]!.open();
    expect(root.value.status()).toBe('OPEN');
    root.dispose();
    expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
  });

  it('closes a constructor result that disposes the owner before returning', () => {
    let dispose = () => {};
    const DisposingWebSocket = function DisposingWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      dispose();
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: DisposingWebSocket,
        immediate: false
      })
    );
    dispose = root.dispose;

    expect(root.value.open()).toBe(false);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('does not dereference cleared ownership after a readyState getter disposes the owner', () => {
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false
      })
    );
    root.value.open();
    const currentSocket = MockWebSocket.instances[0]!;
    let armed = true;
    Object.defineProperty(currentSocket, 'readyState', {
      configurable: true,
      get() {
        if (armed) {
          armed = false;
          root.dispose();
        }
        return MockWebSocket.CONNECTING;
      }
    });

    expect(() => root.value.open()).not.toThrow();
    expect(root.value.open()).toBe(false);
    expect(root.value.status()).toBe('CLOSED');
    expect(currentSocket.close).toHaveBeenCalledOnce();
  });

  it.each(['readyState', 'CONNECTING', 'OPEN'] as const)(
    'rolls back when the initial socket %s getter throws',
    (property) => {
      const initialStateError = new Error(`${property} failed`);
      const onError = vi.fn();
      let constructions = 0;
      const ThrowingStateWebSocket = function ThrowingStateWebSocket(
        url: string | URL,
        protocols?: string | string[]
      ) {
        constructions += 1;
        const currentSocket = new MockWebSocket(url, protocols);
        if (constructions === 1) {
          if (property === 'OPEN') {
            currentSocket.readyState = MockWebSocket.OPEN;
          }
          Object.defineProperty(currentSocket, property, {
            configurable: true,
            get() {
              throw initialStateError;
            }
          });
        }
        return currentSocket;
      } as unknown as typeof WebSocket;
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: ThrowingStateWebSocket,
          immediate: false,
          onError
        })
      );

      expect(root.value.open()).toBe(false);

      expect(root.value.error()).toBe(initialStateError);
      expect(onError).toHaveBeenCalledWith(initialStateError);
      expect(root.value.status()).toBe('CLOSED');
      expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();

      expect(root.value.open()).toBe(true);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(root.value.error()).toBeNull();
      expect(root.value.status()).toBe('CONNECTING');
      root.dispose();
      expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
    }
  );

  it('stops setup when the binaryType setter disposes the owner', () => {
    let dispose = () => {};
    const addEventListener = vi.fn();
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      vi.spyOn(currentSocket, 'addEventListener').mockImplementation(addEventListener);
      Object.defineProperty(currentSocket, 'binaryType', {
        configurable: true,
        set() {
          dispose();
        }
      });
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false,
        binaryType: 'arraybuffer'
      })
    );
    dispose = root.dispose;

    expect(root.value.open()).toBe(false);
    expect(addEventListener).not.toHaveBeenCalled();
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('rolls back listener setup when registration disposes the owner', () => {
    let dispose = () => {};
    let armed = true;
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      const addEventListener = currentSocket.addEventListener.bind(currentSocket);
      vi.spyOn(currentSocket, 'addEventListener').mockImplementation((...args) => {
        addEventListener(...args);
        if (armed) {
          armed = false;
          dispose();
        }
      });
      vi.spyOn(currentSocket, 'removeEventListener');
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false
      })
    );
    dispose = root.dispose;

    const openResult = root.value.open();
    const currentSocket = MockWebSocket.instances[0]!;

    expect(openResult).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(currentSocket.removeEventListener).toHaveBeenCalledOnce();
    expect(currentSocket.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('preserves listener cleanup when registration reentrantly reconnects', () => {
    let reconnect = () => false;
    let armed = true;
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      const addEventListener = currentSocket.addEventListener.bind(currentSocket);
      vi.spyOn(currentSocket, 'addEventListener').mockImplementation((...args) => {
        addEventListener(...args);
        if (armed) {
          armed = false;
          reconnect();
        }
      });
      vi.spyOn(currentSocket, 'removeEventListener');
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false
      })
    );
    reconnect = root.value.reconnect;

    expect(root.value.open()).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[0]!.removeEventListener).toHaveBeenCalledOnce();
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();

    root.dispose();
    expect(MockWebSocket.instances[1]!.removeEventListener).toHaveBeenCalledTimes(4);
    expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
  });

  it('rolls back every registered listener when setup throws', () => {
    const setupError = new Error('listener setup failed');
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      const addEventListener = currentSocket.addEventListener.bind(currentSocket);
      let addCalls = 0;
      vi.spyOn(currentSocket, 'addEventListener').mockImplementation((...args) => {
        addCalls += 1;
        addEventListener(...args);
        if (addCalls === 2) {
          throw setupError;
        }
      });
      vi.spyOn(currentSocket, 'removeEventListener');
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false
      })
    );

    expect(() => root.value.open()).toThrow(setupError);
    expect(MockWebSocket.instances[0]!.removeEventListener).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('preserves replacement cleanup when listener removal reentrantly opens', () => {
    let open = () => false;
    let armed = true;
    const onClose = vi.fn();
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      const removeEventListener = currentSocket.removeEventListener.bind(currentSocket);
      vi.spyOn(currentSocket, 'removeEventListener').mockImplementation((...args) => {
        removeEventListener(...args);
        if (armed) {
          armed = false;
          open();
        }
      });
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false,
        onClose
      })
    );
    open = root.value.open;
    root.value.open();

    MockWebSocket.instances[0]!.serverClose();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[0]!.removeEventListener).toHaveBeenCalledTimes(4);
    expect(MockWebSocket.instances[1]!.removeEventListener).not.toHaveBeenCalled();
    expect(root.value.status()).toBe('CONNECTING');
    expect(onClose).not.toHaveBeenCalled();

    root.dispose();
    expect(MockWebSocket.instances[1]!.removeEventListener).toHaveBeenCalledTimes(4);
    expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
  });

  it('continues listener cleanup when one removal throws', () => {
    const cleanupError = new Error('listener cleanup failed');
    let failCleanup = true;
    const ConfiguringWebSocket = function ConfiguringWebSocket(
      url: string | URL,
      protocols?: string | string[]
    ) {
      const currentSocket = new MockWebSocket(url, protocols);
      const removeEventListener = currentSocket.removeEventListener.bind(currentSocket);
      vi.spyOn(currentSocket, 'removeEventListener').mockImplementation((...args) => {
        removeEventListener(...args);
        if (failCleanup) {
          failCleanup = false;
          throw cleanupError;
        }
      });
      return currentSocket;
    } as unknown as typeof WebSocket;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ConfiguringWebSocket,
        immediate: false
      })
    );
    root.value.open();
    MockWebSocket.instances[0]!.open();

    expect(() => root.dispose()).not.toThrow();

    expect(MockWebSocket.instances[0]!.removeEventListener).toHaveBeenCalledTimes(4);
    expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('does not close twice when the CLOSING signal update disposes the owner', () => {
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === 'CLOSING') {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false
        })
      );
      dispose = root.dispose;
      root.value.open();
      MockWebSocket.instances[0]!.open();
      armed = true;

      root.value.close();

      expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledOnce();
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not roll back a replacement opened before an old close throws', () => {
    const closeError = new Error('close failed after replacement');
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false
      })
    );
    root.value.open();
    const oldSocket = MockWebSocket.instances[0]!;
    oldSocket.open();
    oldSocket.close.mockImplementationOnce(() => {
      oldSocket.readyState = MockWebSocket.CLOSED;
      root.value.open();
      throw closeError;
    });

    root.value.close();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(root.value.status()).toBe('CONNECTING');
    expect(root.value.error()).toBeNull();
    MockWebSocket.instances[1]!.open();
    expect(root.value.status()).toBe('OPEN');
    root.dispose();
    expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
  });

  it('does not reconnect when a constructor error callback closes the connection', () => {
    vi.useFakeTimers();
    let closeFromError = () => {};
    let constructions = 0;
    class ThrowingWebSocket {
      constructor() {
        constructions += 1;
        throw new Error('connect failed');
      }
    }
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: ThrowingWebSocket as never,
        autoReconnect: { retries: 1, delay: 0 },
        immediate: false,
        onError() {
          closeFromError();
          throw new Error('error callback failed');
        }
      })
    );
    closeFromError = root.value.close;

    expect(root.value.open()).toBe(false);

    expect(root.value.status()).toBe('CLOSED');
    expect(root.value.reconnectCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(constructions).toBe(1);
    root.dispose();
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

  it('returns false when send and error callback both throw', () => {
    const sendError = new Error('send failed');
    const onError = vi.fn(() => {
      throw new Error('error callback failed');
    });
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

  it('does not send after serialize disposes the owner', () => {
    let dispose = () => {};
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false,
        serialize(payload: string) {
          dispose();
          return payload;
        }
      })
    );
    dispose = root.dispose;
    root.value.open();
    const currentSocket = MockWebSocket.instances[0]!;
    currentSocket.open();

    expect(root.value.send('terminal-send')).toBe(false);
    expect(currentSocket.send).not.toHaveBeenCalled();
    expect(currentSocket.close).toHaveBeenCalledOnce();
    expect(root.value.status()).toBe('CLOSED');
  });

  it('does not send on a stale socket after serialize reconnects', () => {
    let reconnect = () => false;
    let armed = false;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false,
        serialize(payload: string) {
          if (armed) {
            armed = false;
            reconnect();
          }
          return payload;
        }
      })
    );
    reconnect = root.value.reconnect;
    root.value.open();
    const oldSocket = MockWebSocket.instances[0]!;
    oldSocket.open();
    armed = true;

    expect(root.value.send('stale-send')).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(oldSocket.send).not.toHaveBeenCalled();
    expect(oldSocket.close).toHaveBeenCalledOnce();
    root.dispose();
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

  it('does not schedule a reconnect after the count signal update disposes the owner', () => {
    vi.useFakeTimers();
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 1) {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          autoReconnect: { retries: 1, delay: 10 }
        })
      );
      dispose = root.dispose;
      root.value.open();

      MockWebSocket.instances[0]!.serverClose();

      expect(root.value.reconnectCount()).toBe(0);
      expect(root.value.status()).toBe('CLOSED');
      expect(vi.getTimerCount()).toBe(0);
      vi.runAllTimers();
      expect(MockWebSocket.instances).toHaveLength(1);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it.each(['close', 'dispose'] as const)(
    'does not schedule reconnect when the delay callback calls %s',
    (operation) => {
      vi.useFakeTimers();
      let runOperation = () => {};
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          autoReconnect: {
            retries: 1,
            delay() {
              runOperation();
              return 0;
            }
          }
        })
      );
      runOperation = operation === 'close' ? root.value.close : root.dispose;
      root.value.open();

      MockWebSocket.instances[0]!.serverClose();

      expect(vi.getTimerCount()).toBe(0);
      expect(root.value.reconnectCount()).toBe(0);
      vi.runAllTimers();
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(root.value.status()).toBe('CLOSED');
    }
  );

  it('does not retain a timer handle when setTimeout fires synchronously', () => {
    const setTimeoutRef = vi.fn((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 42;
    });
    const clearTimeoutRef = vi.fn();
    vi.stubGlobal('setTimeout', setTimeoutRef);
    vi.stubGlobal('clearTimeout', clearTimeoutRef);
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false,
        autoReconnect: { retries: 2, delay: 0 }
      })
    );
    root.value.open();

    MockWebSocket.instances[0]!.serverClose();
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1]!.serverClose();
    expect(MockWebSocket.instances).toHaveLength(3);
    expect(clearTimeoutRef).not.toHaveBeenCalledWith(42);
    root.dispose();
  });

  it('auto reconnects when onClose throws', () => {
    vi.useFakeTimers();
    const callbackError = new Error('close callback failed');
    const { value: state } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        autoReconnect: { retries: 1, delay: 0 },
        onClose() {
          throw callbackError;
        }
      })
    );

    MockWebSocket.instances[0]!.serverClose();

    expect(state.error()).toBe(callbackError);
    expect(state.reconnectCount()).toBe(1);
    vi.runAllTimers();
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('does not schedule auto reconnect when onClose opens a replacement', () => {
    vi.useFakeTimers();
    let openReplacement = () => false;
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        autoReconnect: { retries: 1, delay: 100 },
        onClose() {
          openReplacement();
        }
      })
    );
    openReplacement = root.value.open;

    MockWebSocket.instances[0]!.serverClose();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(root.value.reconnectCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(2);
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

  it('does not call onClose after the status signal update disposes the owner', () => {
    const onClose = vi.fn();
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 'CLOSED') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false,
          onClose
        })
      );
      dispose = root.dispose;
      root.value.open();

      MockWebSocket.instances[0]!.serverClose();

      expect(onClose).not.toHaveBeenCalled();
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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

  it('accepts replacement ownership when an old reconnect close throws', () => {
    const closeError = new Error('old close failed after replacement');
    const root = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false
      })
    );
    root.value.open();
    const oldSocket = MockWebSocket.instances[0]!;
    oldSocket.open();
    oldSocket.close.mockImplementationOnce(() => {
      oldSocket.readyState = MockWebSocket.CLOSED;
      root.value.open();
      throw closeError;
    });

    expect(root.value.reconnect()).toBe(true);

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(root.value.status()).toBe('CONNECTING');
    expect(root.value.error()).toBeNull();
    MockWebSocket.instances[1]!.open();
    expect(root.value.status()).toBe('OPEN');
    root.dispose();
    expect(MockWebSocket.instances[1]!.close).toHaveBeenCalledOnce();
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

  it('closes a manually opened socket when open is called with an empty url', () => {
    const source = createSignal<string | null>('ws://fict.test');
    const { value: state } = createRoot(() =>
      useWebSocket(() => source(), {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        immediate: false
      })
    );

    expect(state.open()).toBe(true);
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    source(null);

    expect(state.open()).toBe(false);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(state.status()).toBe('CLOSED');
    expect(state.send('after-empty-url')).toBe(false);
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

  it('does not bind listeners after the status update disposes the owner', () => {
    const addEventListener = vi.spyOn(MockWebSocket.prototype, 'addEventListener');
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 'CONNECTING') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useWebSocket('ws://fict.test', {
          webSocket: MockWebSocket as unknown as typeof WebSocket,
          immediate: false
        })
      );
      dispose = root.dispose;

      expect(root.value.open()).toBe(false);
      expect(addEventListener).not.toHaveBeenCalled();
      expect(MockWebSocket.instances[0]!.close).toHaveBeenCalledTimes(1);
      expect(root.value.status()).toBe('CLOSED');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not reconnect or call user callbacks after dispose when close throws', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onError = vi.fn();
    const { value: state, dispose } = createRoot(() =>
      useWebSocket('ws://fict.test', {
        webSocket: MockWebSocket as unknown as typeof WebSocket,
        autoReconnect: { retries: 1, delay: 0 },
        onClose,
        onError
      })
    );
    const socket = MockWebSocket.instances[0]!;
    socket.open();
    socket.close.mockImplementationOnce(() => {
      throw new Error('close failed');
    });

    dispose();
    socket.serverClose();
    vi.runAllTimers();

    expect(state.status()).toBe('CLOSED');
    expect(state.send('after-dispose')).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
