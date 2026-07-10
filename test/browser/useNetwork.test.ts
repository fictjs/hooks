import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useNetwork } from '../../src/browser/useNetwork';

class MockConnection extends EventTarget {
  downlink = 10;
  effectiveType = '4g';
  rtt = 40;
  saveData = false;
  type = 'wifi';
}

describe('useNetwork', () => {
  it('reads initial network information', () => {
    const connection = new MockConnection();
    const navigatorRef = {
      onLine: true,
      connection
    } as unknown as Navigator;
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useNetwork({ window: windowRef, navigator: navigatorRef as never })
    );

    expect(state.online()).toBe(true);
    expect(state.downlink()).toBe(10);
    expect(state.effectiveType()).toBe('4g');
    expect(state.type()).toBe('wifi');
  });

  it('reacts to online/offline events', () => {
    const connection = new MockConnection();
    const navigatorRef = {
      onLine: true,
      connection
    } as { onLine: boolean; connection: MockConnection };
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useNetwork({ window: windowRef, navigator: navigatorRef as never })
    );

    navigatorRef.onLine = false;
    windowRef.dispatchEvent(new Event('offline'));
    expect(state.online()).toBe(false);

    navigatorRef.onLine = true;
    windowRef.dispatchEvent(new Event('online'));
    expect(state.online()).toBe(true);
  });

  it('reacts to connection change events', () => {
    const connection = new MockConnection();
    const navigatorRef = {
      onLine: true,
      connection
    } as unknown as Navigator;
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useNetwork({ window: windowRef, navigator: navigatorRef as never })
    );

    connection.effectiveType = '3g';
    connection.downlink = 2.5;
    connection.dispatchEvent(new Event('change'));

    expect(state.effectiveType()).toBe('3g');
    expect(state.downlink()).toBe(2.5);
  });

  it('stops a composite update when its online write disposes the owner', () => {
    const connection = new MockConnection();
    const navigatorRef = {
      onLine: true,
      connection
    } as { onLine: boolean; connection: MockConnection };
    const windowRef = new EventTarget() as Window;
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === false) {
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
        useNetwork({ window: windowRef, navigator: navigatorRef as never })
      );
      dispose = root.dispose;
      navigatorRef.onLine = false;
      connection.downlink = 1;
      armed = true;

      windowRef.dispatchEvent(new Event('offline'));

      expect(root.value.online()).toBe(false);
      expect(root.value.downlink()).toBe(10);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it.each(['connection', 'online', 'downlink'] as const)(
    'stops an update when the %s getter disposes the owner',
    (phase) => {
      const connection = new MockConnection();
      const windowRef = new EventTarget() as Window;
      let dispose = () => {};
      let armed = false;
      let online = true;
      let downlink = 10;
      const navigatorRef = {} as { onLine: boolean; connection: MockConnection };
      Object.defineProperty(navigatorRef, 'connection', {
        configurable: true,
        get() {
          if (armed && phase === 'connection') {
            dispose();
          }
          return connection;
        }
      });
      Object.defineProperty(navigatorRef, 'onLine', {
        configurable: true,
        get() {
          if (armed && phase === 'online') {
            dispose();
          }
          return online;
        }
      });
      Object.defineProperty(connection, 'downlink', {
        configurable: true,
        get() {
          if (armed && phase === 'downlink') {
            dispose();
          }
          return downlink;
        }
      });
      const root = createRoot(() =>
        useNetwork({ window: windowRef, navigator: navigatorRef as never })
      );
      dispose = root.dispose;
      online = false;
      downlink = 1;
      connection.effectiveType = '3g';
      armed = true;

      windowRef.dispatchEvent(new Event('offline'));

      expect(root.value.online()).toBe(phase === 'downlink' ? false : true);
      expect(root.value.downlink()).toBe(10);
      expect(root.value.effectiveType()).toBe('4g');
    }
  );

  it('falls back without navigator', () => {
    const { value: state } = createRoot(() => useNetwork({ window: null, navigator: null }));

    expect(state.online()).toBe(true);
    expect(state.downlink()).toBeNull();
    expect(state.isSupported()).toBe(false);
  });
});
