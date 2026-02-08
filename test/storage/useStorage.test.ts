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
