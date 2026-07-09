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
  const windowRef = window as Window & { ResizeObserver?: typeof ResizeObserver };
  const originalWindow = windowRef.ResizeObserver;
  const originalGlobal = globalThis.ResizeObserver;

  afterEach(() => {
    windowRef.ResizeObserver = originalWindow;
    globalThis.ResizeObserver = originalGlobal;
    MockResizeObserver.instances = [];
  });

  it('observes targets and updates entries', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    const callback = vi.fn();

    const { value: state } = createRoot(() => useResizeObserver(element, callback));

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element, undefined);

    const entry = { target: element } as unknown as ResizeObserverEntry;
    instance.trigger([entry]);

    expect(state.entries()).toEqual([entry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('observes ref-like target after it is assigned', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    const ref = { current: null as Element | null };

    createRoot(() => useResizeObserver(ref));
    ref.current = element;
    await Promise.resolve();

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element, undefined);
  });

  it('retries an unresolved ref when start is called while active', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const element = document.createElement('div');
    const ref = { current: null as Element | null };
    const { value: state } = createRoot(() => useResizeObserver(ref));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = element;
    state.start();

    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0]!.observe).toHaveBeenCalledWith(element, undefined);
  });

  it('refreshes observation after a non-reactive ref changes', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const { value: state } = createRoot(() => useResizeObserver(ref));

    ref.current = second;
    state.refresh();

    expect(MockResizeObserver.instances).toHaveLength(2);
    expect(MockResizeObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockResizeObserver.instances[1]!.observe).toHaveBeenCalledWith(second, undefined);
  });

  it('stops observing with controls', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

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

  it('does not use global ResizeObserver when window is null', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const { value: state } = createRoot(() =>
      useResizeObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
    expect(MockResizeObserver.instances).toHaveLength(0);
  });
});
