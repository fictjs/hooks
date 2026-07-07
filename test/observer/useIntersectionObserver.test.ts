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
  const windowRef = window as Window & { IntersectionObserver?: typeof IntersectionObserver };
  const originalWindow = windowRef.IntersectionObserver;
  const originalGlobal = globalThis.IntersectionObserver;

  afterEach(() => {
    windowRef.IntersectionObserver = originalWindow;
    globalThis.IntersectionObserver = originalGlobal;
    MockIntersectionObserver.instances = [];
  });

  it('observes targets and updates entries', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;

    const element = document.createElement('div');
    const callback = vi.fn();

    const { value: state } = createRoot(() => useIntersectionObserver(element, callback));

    const instance = MockIntersectionObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element);

    const entry = { isIntersecting: true, target: element } as unknown as IntersectionObserverEntry;
    instance.trigger([entry]);

    expect(state.entries()).toEqual([entry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('observes ref-like target after it is assigned', async () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;

    const element = document.createElement('div');
    const ref = { current: null as Element | null };

    createRoot(() => useIntersectionObserver(ref));
    ref.current = element;
    await Promise.resolve();

    const instance = MockIntersectionObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element);
  });

  it('supports stop/start controls', async () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;

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

  it('does not use global IntersectionObserver when window is null', () => {
    globalThis.IntersectionObserver = MockIntersectionObserver as never;

    const { value: state } = createRoot(() =>
      useIntersectionObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });
});
