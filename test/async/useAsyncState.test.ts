import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncState } from '../../src/async/useAsyncState';

describe('useAsyncState', () => {
  it('updates state on successful execute', async () => {
    const { value: state } = createRoot(() => useAsyncState(async (value: number) => value * 2, 0));

    expect(state.state()).toBe(0);

    const result = await state.execute(3);

    expect(result).toBe(6);
    expect(state.state()).toBe(6);
    expect(state.isLoading()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('stores error on failure', async () => {
    const onError = vi.fn();

    const { value: state } = createRoot(() =>
      useAsyncState(
        async () => {
          throw new Error('boom');
        },
        1,
        { onError }
      )
    );

    await expect(state.execute()).rejects.toThrow('boom');
    expect(onError).toHaveBeenCalledTimes(1);
    expect((state.error() as Error).message).toBe('boom');
    expect(state.isLoading()).toBe(false);
  });

  it('ignores stale async results', async () => {
    let resolveA: ((value: number) => void) | undefined;
    let resolveB: ((value: number) => void) | undefined;

    const executor = vi.fn(
      (tag: 'a' | 'b') =>
        new Promise<number>((resolve) => {
          if (tag === 'a') {
            resolveA = resolve;
          } else {
            resolveB = resolve;
          }
        })
    );

    const { value: state } = createRoot(() => useAsyncState(executor, 0));

    const promiseA = state.execute('a');
    const promiseB = state.execute('b');

    resolveB!(2);
    await promiseB;
    expect(state.state()).toBe(2);

    resolveA!(1);
    await promiseA;
    expect(state.state()).toBe(2);
  });

  it('supports immediate execution', async () => {
    const { value: state } = createRoot(() => useAsyncState(async () => 7, 0, { immediate: true }));

    await Promise.resolve();
    await Promise.resolve();

    expect(state.state()).toBe(7);
    expect(state.isLoading()).toBe(false);
  });
});
