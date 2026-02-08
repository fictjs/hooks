import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useLocalStorage } from '../../src/storage/useLocalStorage';

describe('useLocalStorage', () => {
  it('reads and writes localStorage', () => {
    localStorage.removeItem('fict-local');

    const { value: state } = createRoot(() => useLocalStorage('fict-local', 5));

    expect(state.value()).toBe(5);

    state.set(9);
    expect(localStorage.getItem('fict-local')).toBe('9');

    state.remove();
    expect(localStorage.getItem('fict-local')).toBeNull();
  });

  it('falls back to in-memory signal when window is unavailable', () => {
    const { value: state } = createRoot(() =>
      useLocalStorage('fict-local-ssr', 1, { window: {} as Window })
    );

    expect(state.value()).toBe(1);
    state.set(2);
    expect(state.value()).toBe(2);
  });

  it('forwards serializer errors to onError callback', () => {
    const onError = vi.fn();
    const storage = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('cannot write');
      },
      removeItem() {},
      clear() {},
      key() {
        return null;
      },
      length: 0
    } as Storage;

    const windowRef = new EventTarget() as Window;
    Object.defineProperty(windowRef, 'localStorage', {
      configurable: true,
      value: storage
    });

    const { value: state } = createRoot(() =>
      useLocalStorage('fict-local-error', 1, {
        window: windowRef,
        onError
      })
    );

    state.set(3);
    expect(onError).toHaveBeenCalled();
    const lastOnErrorCall = onError.mock.calls[onError.mock.calls.length - 1];
    expect((lastOnErrorCall?.[0] as Error).message).toBe('cannot write');
  });
});
