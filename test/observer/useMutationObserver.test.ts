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
  const original = globalThis.MutationObserver;

  afterEach(() => {
    globalThis.MutationObserver = original;
    MockMutationObserver.instances = [];
  });

  it('observes targets and updates records', () => {
    globalThis.MutationObserver = MockMutationObserver as never;

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

  it('stops observing with controls', () => {
    globalThis.MutationObserver = MockMutationObserver as never;

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
});
