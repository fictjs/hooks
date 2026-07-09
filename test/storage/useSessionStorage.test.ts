import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useSessionStorage } from '../../src/storage/useSessionStorage';

describe('useSessionStorage', () => {
  it('reads and writes sessionStorage', () => {
    sessionStorage.removeItem('fict-session');

    const { value: state } = createRoot(() => useSessionStorage('fict-session', 'a'));

    expect(state.value()).toBe('a');

    state.set('b');
    expect(sessionStorage.getItem('fict-session')).toBe('b');

    state.remove();
    expect(sessionStorage.getItem('fict-session')).toBeNull();
  });

  it('falls back to in-memory signal when window is unavailable', () => {
    const { value: state } = createRoot(() =>
      useSessionStorage('fict-session-ssr', 'guest', { window: {} as Window })
    );

    expect(state.value()).toBe('guest');
    state.set('member');
    expect(state.value()).toBe('member');
  });

  it('does not touch real sessionStorage when window is null', () => {
    const key = 'fict-session-window-null';
    sessionStorage.removeItem(key);

    const { value: state } = createRoot(() => useSessionStorage(key, 'guest', { window: null }));

    state.set('member');

    expect(state.value()).toBe('member');
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('forwards serializer errors to onError callback', () => {
    const onError = vi.fn();
    const storage = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('cannot write session');
      },
      removeItem() {},
      clear() {},
      key() {
        return null;
      },
      length: 0
    } as Storage;

    const windowRef = new EventTarget() as Window;
    Object.defineProperty(windowRef, 'sessionStorage', {
      configurable: true,
      value: storage
    });

    const { value: state } = createRoot(() =>
      useSessionStorage('fict-session-error', 'a', {
        window: windowRef,
        onError
      })
    );

    state.set('b');
    expect(onError).toHaveBeenCalled();
    const lastOnErrorCall = onError.mock.calls[onError.mock.calls.length - 1];
    expect((lastOnErrorCall?.[0] as Error).message).toBe('cannot write session');
  });

  it('falls back to memory when the sessionStorage getter is blocked', () => {
    const onError = vi.fn();
    const windowRef = new EventTarget() as Window;
    Object.defineProperty(windowRef, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      }
    });

    const { value: state } = createRoot(() =>
      useSessionStorage('blocked-session-storage', 'initial', { window: windowRef, onError })
    );
    state.set('next');

    expect(state.value()).toBe('next');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ name: 'SecurityError' });
  });
});
