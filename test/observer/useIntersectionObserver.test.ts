import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionObserver } from '../../src/observer/useIntersectionObserver';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  static errorTarget: Element | undefined;
  static triggerDuringObserve = false;

  readonly observe = vi.fn((target: Element) => {
    if (target === MockIntersectionObserver.errorTarget) {
      throw new Error('observe failed');
    }
    if (MockIntersectionObserver.triggerDuringObserve) {
      this.trigger([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry]);
    }
  });
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
    MockIntersectionObserver.errorTarget = undefined;
    MockIntersectionObserver.triggerDuringObserve = false;
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

  it('retries an unresolved ref when start is called while active', async () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    const ref = { current: null as Element | null };
    const { value: state } = createRoot(() => useIntersectionObserver(ref));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = element;
    state.start();

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0]!.observe).toHaveBeenCalledWith(element);
  });

  it('refreshes observation after a non-reactive ref changes', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const { value: state } = createRoot(() => useIntersectionObserver(ref));

    ref.current = second;
    state.refresh();

    expect(MockIntersectionObserver.instances).toHaveLength(2);
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver.instances[1]!.observe).toHaveBeenCalledWith(second);
  });

  it('retains cleanup ownership when observe synchronously refreshes', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const stateRef = {
      current: undefined as ReturnType<typeof useIntersectionObserver> | undefined
    };
    let refreshed = false;
    const root = createRoot(() =>
      useIntersectionObserver([first, second], () => {
        if (!refreshed) {
          refreshed = true;
          stateRef.current!.refresh();
        }
      })
    );
    const state = root.value;
    stateRef.current = state;

    MockIntersectionObserver.triggerDuringObserve = true;
    state.refresh();

    expect(MockIntersectionObserver.instances).toHaveLength(3);
    expect(MockIntersectionObserver.instances[1]!.observe).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver.instances[1]!.observe).toHaveBeenCalledWith(first);
    expect(MockIntersectionObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenCalledTimes(2);
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenNthCalledWith(1, first);
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenNthCalledWith(2, second);
    expect(MockIntersectionObserver.instances[2]!.disconnect).not.toHaveBeenCalled();

    state.stop();
    expect(
      MockIntersectionObserver.instances.every(
        (instance) => instance.disconnect.mock.calls.length === 1
      )
    ).toBe(true);
  });

  it('ignores callbacks from refreshed and disposed observers', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const callback = vi.fn();
    const { value: state, dispose } = createRoot(() => useIntersectionObserver(ref, callback));
    const staleObserver = MockIntersectionObserver.instances[0]!;

    ref.current = second;
    state.refresh();
    const currentObserver = MockIntersectionObserver.instances[1]!;
    const staleEntry = {
      isIntersecting: true,
      target: first
    } as unknown as IntersectionObserverEntry;
    staleObserver.trigger([staleEntry]);

    expect(state.entries()).toEqual([]);
    expect(callback).not.toHaveBeenCalled();

    const currentEntry = {
      isIntersecting: true,
      target: second
    } as unknown as IntersectionObserverEntry;
    currentObserver.trigger([currentEntry]);
    expect(state.entries()).toEqual([currentEntry]);
    expect(callback).toHaveBeenCalledTimes(1);

    dispose();
    currentObserver.trigger([staleEntry]);

    expect(state.entries()).toEqual([currentEntry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disconnects when observing a later target throws', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    MockIntersectionObserver.errorTarget = second;

    expect(() => createRoot(() => useIntersectionObserver([first, second]))).toThrow(
      'observe failed'
    );

    const instance = MockIntersectionObserver.instances[0]!;
    expect(instance.observe).toHaveBeenNthCalledWith(1, first);
    expect(instance.observe).toHaveBeenNthCalledWith(2, second);
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
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
