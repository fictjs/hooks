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
});
