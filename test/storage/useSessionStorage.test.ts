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
    expect((onError.mock.calls.at(-1)?.[0] as Error).message).toBe('cannot write session');
  });
});
