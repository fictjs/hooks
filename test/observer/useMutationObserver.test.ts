import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMutationObserver } from '../../src/observer/useMutationObserver';

class MockMutationObserver {
  static instances: MockMutationObserver[] = [];

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  private callback: MutationCallback;

  constructor(callback: MutationCallback) {
    this.callback = callback;
    MockMutationObserver.instances.push(this);
  }

  trigger(records: MutationRecord[]): void {
    this.callback(records, this as unknown as MutationObserver);
  }
}

describe('useMutationObserver', () => {
  const windowRef = window as Window & { MutationObserver?: typeof MutationObserver };
  const originalWindow = windowRef.MutationObserver;
  const originalGlobal = globalThis.MutationObserver;

  afterEach(() => {
    windowRef.MutationObserver = originalWindow;
    globalThis.MutationObserver = originalGlobal;
    MockMutationObserver.instances = [];
  });

  it('observes targets and updates records', () => {
    windowRef.MutationObserver = MockMutationObserver as never;

    const element = document.createElement('div');
    const callback = vi.fn();

    const { value: state } = createRoot(() => useMutationObserver(element, callback));

    const instance = MockMutationObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ subtree: true, childList: true })
    );

    const record = { type: 'childList', target: element } as unknown as MutationRecord;
    instance.trigger([record]);

    expect(state.records()).toEqual([record]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('observes ref-like target after it is assigned', async () => {
    windowRef.MutationObserver = MockMutationObserver as never;

    const element = document.createElement('div');
    const ref = { current: null as Element | null };

    createRoot(() => useMutationObserver(ref));
    ref.current = element;
    await Promise.resolve();

    const instance = MockMutationObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ subtree: true, childList: true })
    );
  });

  it('retries an unresolved ref when start is called while active', async () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const ref = { current: null as Element | null };
    const { value: state } = createRoot(() => useMutationObserver(ref));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = element;
    state.start();

    expect(MockMutationObserver.instances).toHaveLength(1);
    expect(MockMutationObserver.instances[0]!.observe).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ subtree: true, childList: true })
    );
  });

  it('refreshes observation after a non-reactive ref changes', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const { value: state } = createRoot(() => useMutationObserver(ref));

    ref.current = second;
    state.refresh();

    expect(MockMutationObserver.instances).toHaveLength(2);
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockMutationObserver.instances[1]!.observe).toHaveBeenCalledWith(
      second,
      expect.objectContaining({ subtree: true, childList: true })
    );
  });

  it('stops observing with controls', () => {
    windowRef.MutationObserver = MockMutationObserver as never;

    const element = document.createElement('div');
    const { value: state } = createRoot(() => useMutationObserver(element));
    const instance = MockMutationObserver.instances[0]!;

    state.stop();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('handles unsupported env', () => {
    globalThis.MutationObserver = undefined as never;

    const { value: state } = createRoot(() =>
      useMutationObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
  });

  it('does not use global MutationObserver when window is null', () => {
    globalThis.MutationObserver = MockMutationObserver as never;

    const { value: state } = createRoot(() =>
      useMutationObserver(document.createElement('div'), undefined, { window: null })
    );

    expect(state.isSupported()).toBe(false);
    expect(MockMutationObserver.instances).toHaveLength(0);
  });
});
