import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
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
    } as Navigator;
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
    } as Navigator;
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

  it('falls back without navigator', () => {
    const { value: state } = createRoot(() => useNetwork({ window: null, navigator: null }));

    expect(state.online()).toBe(true);
    expect(state.downlink()).toBeNull();
    expect(state.isSupported()).toBe(false);
  });
});
