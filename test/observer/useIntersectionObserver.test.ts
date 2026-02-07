import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionObserver } from '../../src/observer/useIntersectionObserver';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(entries: IntersectionObserverEntry[]): void {
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

describe('useIntersectionObserver', () => {
  const original = globalThis.IntersectionObserver;

  afterEach(() => {
    globalThis.IntersectionObserver = original;
    MockIntersectionObserver.instances = [];
  });

  it('observes targets and updates entries', () => {
    globalThis.IntersectionObserver = MockIntersectionObserver as never;

    const element = document.createElement('div');
    const callback = vi.fn();

    const { value: state } = createRoot(() => useIntersectionObserver(element, callback));

    const instance = MockIntersectionObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element);

    const entry = { isIntersecting: true, target: element } as IntersectionObserverEntry;
    instance.trigger([entry]);

    expect(state.entries()).toEqual([entry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('supports stop/start controls', async () => {
    globalThis.IntersectionObserver = MockIntersectionObserver as never;

    const element = document.createElement('div');
    const { value: state } = createRoot(() => useIntersectionObserver(element));

    const instance = MockIntersectionObserver.instances[0]!;
    state.stop();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    state.start();
    await Promise.resolve();
    expect(MockIntersectionObserver.instances.length).toBe(2);
  });

  it('gracefully handles unsupported env', () => {
    globalThis.IntersectionObserver = undefined as never;

    const { value: state } = createRoot(() =>
      useIntersectionObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
  });
});
