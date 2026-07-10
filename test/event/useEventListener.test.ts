import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useEventListener } from '../../src/event/useEventListener';

describe('useEventListener', () => {
  it('binds and handles event', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(target, 'ping', handler);
    });

    target.dispatchEvent(new Event('ping'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports multiple events', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(target, ['foo', 'bar'], handler);
    });

    target.dispatchEvent(new Event('foo'));
    target.dispatchEvent(new Event('bar'));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('rolls back listeners when setup fails partway through', () => {
    const firstTarget = new EventTarget();
    const failingTarget = new EventTarget();
    const setupError = new Error('listener setup failed');
    const addFailingListener = failingTarget.addEventListener.bind(failingTarget);
    vi.spyOn(failingTarget, 'addEventListener').mockImplementation((...args) => {
      addFailingListener(...args);
      throw setupError;
    });
    const handler = vi.fn();

    expect(() =>
      createRoot(() => useEventListener([firstTarget, failingTarget], 'partial', handler))
    ).toThrow(setupError);

    firstTarget.dispatchEvent(new Event('partial'));
    failingTarget.dispatchEvent(new Event('partial'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('continues removing listeners after one cleanup fails', () => {
    const firstTarget = new EventTarget();
    const secondTarget = new EventTarget();
    const cleanupError = new Error('listener cleanup failed');
    const removeFirstListener = firstTarget.removeEventListener.bind(firstTarget);
    vi.spyOn(firstTarget, 'removeEventListener').mockImplementation((...args) => {
      removeFirstListener(...args);
      throw cleanupError;
    });
    const handler = vi.fn();
    const { value: controls } = createRoot(() =>
      useEventListener([firstTarget, secondTarget], 'cleanup', handler)
    );

    expect(() => controls.stop()).toThrow(cleanupError);

    firstTarget.dispatchEvent(new Event('cleanup'));
    secondTarget.dispatchEvent(new Event('cleanup'));
    expect(handler).not.toHaveBeenCalled();
    expect(controls.active()).toBe(false);
  });

  it('supports stop and start controls', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    const { value: controls } = createRoot(() => useEventListener(target, 'tick', handler));

    target.dispatchEvent(new Event('tick'));
    controls.stop();
    target.dispatchEvent(new Event('tick'));
    controls.start();
    target.dispatchEvent(new Event('tick'));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('removes listeners on dispose', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    const { dispose } = createRoot(() => {
      useEventListener(target, 'pong', handler);
    });

    dispose();
    target.dispatchEvent(new Event('pong'));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('passes abort signal to listener options', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const controller = new AbortController();

    createRoot(() => {
      useEventListener(target, 'abortable', handler, { signal: controller.signal });
    });

    target.dispatchEvent(new Event('abortable'));
    controller.abort();
    target.dispatchEvent(new Event('abortable'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reacts to target changes', async () => {
    const targetA = new EventTarget();
    const targetB = new EventTarget();
    const handler = vi.fn();
    const currentTarget = createSignal<EventTarget>(targetA);

    createRoot(() => {
      useEventListener(() => currentTarget(), 'move', handler);
    });

    targetA.dispatchEvent(new Event('move'));
    currentTarget(targetB);
    await Promise.resolve();

    targetA.dispatchEvent(new Event('move'));
    targetB.dispatchEvent(new Event('move'));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('binds ref-like target after it is assigned', async () => {
    const target = new EventTarget();
    const ref = { current: null as EventTarget | null };
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(ref, 'ready', handler);
    });

    ref.current = target;
    await Promise.resolve();

    target.dispatchEvent(new Event('ready'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retries an unresolved ref when start is called while active', async () => {
    const target = new EventTarget();
    const ref = { current: null as EventTarget | null };
    const handler = vi.fn();
    const { value: controls } = createRoot(() => useEventListener(ref, 'late', handler));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = target;
    controls.start();
    target.dispatchEvent(new Event('late'));

    expect(controls.active()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refreshes listeners after a non-reactive ref changes', () => {
    const targetA = new EventTarget();
    const targetB = new EventTarget();
    const ref = { current: targetA as EventTarget | null };
    const handler = vi.fn();
    const { value: controls } = createRoot(() => useEventListener(ref, 'refresh', handler));

    ref.current = targetB;
    controls.refresh();
    targetA.dispatchEvent(new Event('refresh'));
    targetB.dispatchEvent(new Event('refresh'));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
