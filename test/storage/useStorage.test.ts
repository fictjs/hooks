import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useStorage } from '../../src/storage/useStorage';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('useStorage', () => {
  it('reads and writes values', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useStorage('count', 1, {
        storage,
        window: windowRef
      })
    );

    expect(state.value()).toBe(1);

    state.set(3);
    expect(state.value()).toBe(3);
    expect(storage.getItem('count')).toBe('3');

    state.remove();
    expect(state.value()).toBe(1);
    expect(storage.getItem('count')).toBeNull();
  });

  it('treats undefined writes as remove', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const state = createRoot(() =>
      useStorage<string | undefined>('maybe', 'ready', {
        storage,
        window: windowRef
      })
    ).value;

    state.set(undefined);

    expect(state.value()).toBe('ready');
    expect(storage.getItem('maybe')).toBeNull();
  });

  it('syncs undefined writes as remove in the same window', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const first = createRoot(() =>
      useStorage<string | undefined>('maybe-shared', 'ready', {
        storage,
        window: windowRef
      })
    ).value;
    const second = createRoot(() =>
      useStorage<string | undefined>('maybe-shared', 'ready', {
        storage,
        window: windowRef
      })
    ).value;

    first.set('changed');
    first.set(undefined);

    expect(first.value()).toBe('ready');
    expect(second.value()).toBe('ready');
    expect(storage.getItem('maybe-shared')).toBeNull();
  });

  it('does not write an undefined default value', () => {
    const storage = new MemoryStorage();

    const state = createRoot(() =>
      useStorage<string | undefined>('default-undefined', undefined, {
        storage,
        window: new EventTarget() as Window
      })
    ).value;

    expect(state.value()).toBeUndefined();
    expect(storage.getItem('default-undefined')).toBeNull();
  });

  it('does not touch default localStorage when window is null', () => {
    const key = 'fict-storage-window-null';
    localStorage.removeItem(key);

    const state = createRoot(() => useStorage(key, 1, { window: null })).value;

    state.set(2);

    expect(state.value()).toBe(2);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('falls back to memory when the default storage getter is blocked', () => {
    const onError = vi.fn();
    const windowRef = new EventTarget() as Window;
    Object.defineProperty(windowRef, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      }
    });

    const state = createRoot(() =>
      useStorage('blocked-default-storage', 1, { window: windowRef, onError })
    ).value;
    state.set(2);

    expect(state.value()).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('syncs between hooks in same window', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const first = createRoot(() => useStorage('shared', 0, { storage, window: windowRef })).value;
    const second = createRoot(() => useStorage('shared', 0, { storage, window: windowRef })).value;

    first.set(10);
    expect(second.value()).toBe(10);

    second.set(15);
    expect(first.value()).toBe(15);
  });

  it('persists and syncs direct value signal writes', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const first = createRoot(() =>
      useStorage('direct-write', 0, { storage, window: windowRef })
    ).value;
    const second = createRoot(() =>
      useStorage('direct-write', 0, { storage, window: windowRef })
    ).value;

    (first.value as (next: number) => void)(7);

    expect(storage.getItem('direct-write')).toBe('7');
    expect(first.value()).toBe(7);
    expect(second.value()).toBe(7);
  });

  it('resets value when another document clears the storage area', () => {
    localStorage.removeItem('fict-clear-target');

    const state = createRoot(() =>
      useStorage('fict-clear-target', 1, {
        storage: localStorage,
        window
      })
    ).value;

    state.set(5);
    expect(state.value()).toBe(5);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        newValue: null,
        storageArea: localStorage
      })
    );

    expect(state.value()).toBe(1);
  });

  it('keeps same-window sync listeners when created outside a root', () => {
    const storage = new MemoryStorage();
    const windowRef = new EventTarget() as Window;

    const first = useStorage('rootless-shared', 0, { storage, window: windowRef });
    const second = useStorage('rootless-shared', 0, { storage, window: windowRef });

    first.set(10);
    expect(second.value()).toBe(10);
  });

  it('handles serializer errors via onError', () => {
    const storage = new MemoryStorage();
    const onError = vi.fn();

    const { value: state } = createRoot(() =>
      useStorage(
        'bad',
        { a: 1 },
        {
          storage,
          window: new EventTarget() as Window,
          serializer: {
            read: () => {
              throw new Error('read failed');
            },
            write: () => {
              throw new Error('write failed');
            }
          },
          onError
        }
      )
    );

    state.set({ a: 2 });
    expect(onError).toHaveBeenCalled();
    const lastOnErrorCall = onError.mock.calls[onError.mock.calls.length - 1];
    expect((lastOnErrorCall?.[0] as Error).message).toBe('write failed');
  });
});
