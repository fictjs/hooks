import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResizeObserver } from '../../src/observer/useResizeObserver';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  trigger(entries: ResizeObserverEntry[]): void {
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

describe('useResizeObserver', () => {
  const original = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = original;
    MockResizeObserver.instances = [];
  });

  it('observes targets and updates entries', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    const callback = vi.fn();

    const { value: state } = createRoot(() => useResizeObserver(element, callback));

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element, undefined);

    const entry = { target: element } as ResizeObserverEntry;
    instance.trigger([entry]);

    expect(state.entries()).toEqual([entry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops observing with controls', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    const { value: state } = createRoot(() => useResizeObserver(element));
    const instance = MockResizeObserver.instances[0]!;

    state.stop();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('handles unsupported env', () => {
    globalThis.ResizeObserver = undefined as never;

    const { value: state } = createRoot(() =>
      useResizeObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
  });
});
