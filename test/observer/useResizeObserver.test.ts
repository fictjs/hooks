import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResizeObserver } from '../../src/observer/useResizeObserver';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  static errorTarget: Element | undefined;
  static triggerDuringObserve = false;

  readonly observe = vi.fn((target: Element) => {
    if (target === MockResizeObserver.errorTarget) {
      throw new Error('observe failed');
    }
    if (MockResizeObserver.triggerDuringObserve) {
      this.trigger([{ target } as unknown as ResizeObserverEntry]);
    }
  });
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
    MockResizeObserver.errorTarget = undefined;
    MockResizeObserver.triggerDuringObserve = false;
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

  it('retains cleanup ownership when observe synchronously refreshes', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const stateRef = {
      current: undefined as ReturnType<typeof useResizeObserver> | undefined
    };
    let refreshed = false;
    const root = createRoot(() =>
      useResizeObserver([first, second], () => {
        if (!refreshed) {
          refreshed = true;
          stateRef.current!.refresh();
        }
      })
    );
    const state = root.value;
    stateRef.current = state;

    MockResizeObserver.triggerDuringObserve = true;
    state.refresh();

    expect(MockResizeObserver.instances).toHaveLength(3);
    expect(MockResizeObserver.instances[1]!.observe).toHaveBeenCalledTimes(1);
    expect(MockResizeObserver.instances[1]!.observe).toHaveBeenCalledWith(first, undefined);
    expect(MockResizeObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockResizeObserver.instances[2]!.observe).toHaveBeenCalledTimes(2);
    expect(MockResizeObserver.instances[2]!.observe).toHaveBeenNthCalledWith(1, first, undefined);
    expect(MockResizeObserver.instances[2]!.observe).toHaveBeenNthCalledWith(2, second, undefined);
    expect(MockResizeObserver.instances[2]!.disconnect).not.toHaveBeenCalled();

    state.stop();
    expect(
      MockResizeObserver.instances.every((instance) => instance.disconnect.mock.calls.length === 1)
    ).toBe(true);
  });

  it('ignores callbacks from refreshed and disposed observers', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const callback = vi.fn();
    const { value: state, dispose } = createRoot(() => useResizeObserver(ref, callback));
    const staleObserver = MockResizeObserver.instances[0]!;

    ref.current = second;
    state.refresh();
    const currentObserver = MockResizeObserver.instances[1]!;
    const staleEntry = { target: first } as unknown as ResizeObserverEntry;
    staleObserver.trigger([staleEntry]);

    expect(state.entries()).toEqual([]);
    expect(callback).not.toHaveBeenCalled();

    const currentEntry = { target: second } as unknown as ResizeObserverEntry;
    currentObserver.trigger([currentEntry]);
    expect(state.entries()).toEqual([currentEntry]);
    expect(callback).toHaveBeenCalledTimes(1);

    dispose();
    currentObserver.trigger([staleEntry]);

    expect(state.entries()).toEqual([currentEntry]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disconnects when observing a later target throws', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    MockResizeObserver.errorTarget = second;

    expect(() => createRoot(() => useResizeObserver([first, second]))).toThrow('observe failed');

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenNthCalledWith(1, first, undefined);
    expect(instance.observe).toHaveBeenNthCalledWith(2, second, undefined);
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
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
