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

  it('does not call onError for stale failures', async () => {
    let rejectA: ((error: Error) => void) | undefined;
    let resolveB: ((value: number) => void) | undefined;
    const onError = vi.fn();

    const executor = vi.fn(
      (tag: 'a' | 'b') =>
        new Promise<number>((resolve, reject) => {
          if (tag === 'a') {
            rejectA = reject;
          } else {
            resolveB = resolve;
          }
        })
    );

    const { value: state } = createRoot(() => useAsyncState(executor, 0, { onError }));

    const promiseA = state.execute('a');
    const promiseB = state.execute('b');

    resolveB!(2);
    await promiseB;

    rejectA!(new Error('stale'));
    await expect(promiseA).rejects.toThrow('stale');

    expect(onError).toHaveBeenCalledTimes(0);
    expect(state.error()).toBeNull();
    expect(state.state()).toBe(2);
  });

  it('supports immediate execution', async () => {
    const { value: state } = createRoot(() => useAsyncState(async () => 7, 0, { immediate: true }));

    await Promise.resolve();
    await Promise.resolve();

    expect(state.state()).toBe(7);
    expect(state.isLoading()).toBe(false);
  });

  it('supports immediate execution with typed arguments', async () => {
    const executor = vi.fn(async (value: number, suffix: string) => `${value}:${suffix}`);
    const { value: state } = createRoot(() =>
      useAsyncState(executor, '', {
        immediate: true,
        immediateArgs: [7, 'ready']
      })
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(executor).toHaveBeenCalledWith(7, 'ready');
    expect(state.state()).toBe('7:ready');
    expect(state.isLoading()).toBe(false);
  });

  it('does not commit a pending result or execute again after dispose', async () => {
    let resolveExecution: ((value: number) => void) | undefined;
    const executor = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveExecution = resolve;
        })
    );
    const root = createRoot(() => useAsyncState(executor, 1));

    const pending = root.value.execute();
    expect(root.value.isLoading()).toBe(true);
    root.dispose();
    resolveExecution!(2);

    await expect(pending).resolves.toBe(2);
    expect(root.value.state()).toBe(1);
    expect(root.value.isLoading()).toBe(false);
    await expect(root.value.execute()).resolves.toBe(1);
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('does not report a pending error after dispose', async () => {
    let rejectExecution: ((reason: unknown) => void) | undefined;
    const executionError = new Error('late failure');
    const onError = vi.fn();
    const root = createRoot(() =>
      useAsyncState(
        () =>
          new Promise<number>((_resolve, reject) => {
            rejectExecution = reject;
          }),
        1,
        { onError }
      )
    );

    const pending = root.value.execute();
    root.dispose();
    rejectExecution!(executionError);

    await expect(pending).rejects.toBe(executionError);
    expect(root.value.error()).toBeNull();
    expect(root.value.isLoading()).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });
});
