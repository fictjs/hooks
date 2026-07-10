import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMutationObserver } from '../../src/observer/useMutationObserver';

class MockMutationObserver {
  static instances: MockMutationObserver[] = [];
  static errorTarget: Element | undefined;
  static disconnectError: Error | undefined;
  static onDisconnect: (() => void) | undefined;
  static triggerDuringObserve = false;
  readonly observedTargets = new Set<Element>();

  readonly observe = vi.fn((target: Element) => {
    if (target === MockMutationObserver.errorTarget) {
      throw new Error('observe failed');
    }
    if (MockMutationObserver.triggerDuringObserve) {
      this.trigger([{ type: 'childList', target } as unknown as MutationRecord]);
    }
    this.observedTargets.add(target);
  });
  readonly disconnect = vi.fn(() => {
    this.observedTargets.clear();
    MockMutationObserver.onDisconnect?.();
    if (MockMutationObserver.disconnectError) {
      throw MockMutationObserver.disconnectError;
    }
  });

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
    MockMutationObserver.errorTarget = undefined;
    MockMutationObserver.disconnectError = undefined;
    MockMutationObserver.onDisconnect = undefined;
    MockMutationObserver.triggerDuringObserve = false;
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

  it('keeps the observer created by a refresh reentered from target resolution', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    let refreshOnRead = false;
    const controls = createRoot(() =>
      useMutationObserver(() => {
        if (refreshOnRead) {
          refreshOnRead = false;
          controls.refresh();
        }
        return element;
      })
    ).value;

    refreshOnRead = true;
    controls.refresh();

    expect(MockMutationObserver.instances).toHaveLength(2);
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledOnce();
    expect(MockMutationObserver.instances[1]!.disconnect).not.toHaveBeenCalled();

    controls.stop();
    expect(MockMutationObserver.instances[1]!.disconnect).toHaveBeenCalledOnce();
  });

  it('preserves an observer restarted from the active signal notification', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    let controls: ReturnType<typeof useMutationObserver>;
    let restart = false;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (restart && value === false) {
          restart = false;
          controls.start();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      controls = createRoot(() => useMutationObserver(element)).value;
      restart = true;
      controls.stop();

      expect(controls.active()).toBe(true);
      expect(MockMutationObserver.instances).toHaveLength(1);
      expect(MockMutationObserver.instances[0]!.disconnect).not.toHaveBeenCalled();

      controls.stop();
      expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledOnce();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('rolls back a stale registration completed after observe synchronously refreshes', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const stateRef = {
      current: undefined as ReturnType<typeof useMutationObserver> | undefined
    };
    let refreshed = false;
    const root = createRoot(() =>
      useMutationObserver([first, second], () => {
        if (!refreshed) {
          refreshed = true;
          stateRef.current!.refresh();
        }
      })
    );
    const state = root.value;
    stateRef.current = state;

    MockMutationObserver.triggerDuringObserve = true;
    state.refresh();

    expect(MockMutationObserver.instances).toHaveLength(3);
    expect(MockMutationObserver.instances[1]!.observe).toHaveBeenCalledTimes(1);
    expect(MockMutationObserver.instances[1]!.observe).toHaveBeenCalledWith(
      first,
      expect.objectContaining({ subtree: true, childList: true })
    );
    expect(MockMutationObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(2);
    expect(MockMutationObserver.instances[1]!.observedTargets).toEqual(new Set());
    expect(MockMutationObserver.instances[2]!.observe).toHaveBeenCalledTimes(2);
    expect(MockMutationObserver.instances[2]!.observe).toHaveBeenNthCalledWith(
      1,
      first,
      expect.objectContaining({ subtree: true, childList: true })
    );
    expect(MockMutationObserver.instances[2]!.observe).toHaveBeenNthCalledWith(
      2,
      second,
      expect.objectContaining({ subtree: true, childList: true })
    );
    expect(MockMutationObserver.instances[2]!.disconnect).not.toHaveBeenCalled();
    expect(MockMutationObserver.instances[2]!.observedTargets).toEqual(new Set([first, second]));

    state.stop();
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockMutationObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(2);
    expect(MockMutationObserver.instances[2]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('ignores callbacks from refreshed and disposed observers', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const callback = vi.fn();
    const { value: state, dispose } = createRoot(() => useMutationObserver(ref, callback));
    const staleObserver = MockMutationObserver.instances[0]!;

    ref.current = second;
    state.refresh();
    const currentObserver = MockMutationObserver.instances[1]!;
    const staleRecord = {
      type: 'childList',
      target: first
    } as unknown as MutationRecord;
    staleObserver.trigger([staleRecord]);

    expect(state.records()).toEqual([]);
    expect(callback).not.toHaveBeenCalled();

    const currentRecord = {
      type: 'childList',
      target: second
    } as unknown as MutationRecord;
    currentObserver.trigger([currentRecord]);
    expect(state.records()).toEqual([currentRecord]);
    expect(callback).toHaveBeenCalledTimes(1);

    dispose();
    currentObserver.trigger([staleRecord]);

    expect(state.records()).toEqual([currentRecord]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disconnects when observing a later target throws', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    MockMutationObserver.errorTarget = second;

    expect(() => createRoot(() => useMutationObserver([first, second]))).toThrow('observe failed');

    const instance = MockMutationObserver.instances[0]!;
    expect(instance.observe).toHaveBeenNthCalledWith(
      1,
      first,
      expect.objectContaining({ subtree: true, childList: true })
    );
    expect(instance.observe).toHaveBeenNthCalledWith(
      2,
      second,
      expect.objectContaining({ subtree: true, childList: true })
    );
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('preserves observe errors when rollback disconnect fails', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    MockMutationObserver.errorTarget = second;
    MockMutationObserver.disconnectError = new Error('disconnect failed');

    expect(() => createRoot(() => useMutationObserver([first, second]))).toThrow('observe failed');
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('finalizes cleanup state before disconnect throws', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const state = createRoot(() => useMutationObserver(element)).value;
    MockMutationObserver.disconnectError = new Error('disconnect failed');

    expect(() => state.refresh()).toThrow('disconnect failed');
    expect(() => state.refresh()).not.toThrow();

    expect(MockMutationObserver.instances).toHaveLength(2);
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('stops observing with controls', () => {
    windowRef.MutationObserver = MockMutationObserver as never;

    const element = document.createElement('div');
    const { value: state } = createRoot(() => useMutationObserver(element));
    const instance = MockMutationObserver.instances[0]!;

    state.stop();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not restart after owner disposal', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const root = createRoot(() => useMutationObserver(element));

    root.dispose();
    root.value.start();
    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(MockMutationObserver.instances).toHaveLength(1);
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not continue refresh when disconnect disposes the owner', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const root = createRoot(() => useMutationObserver(element));
    MockMutationObserver.onDisconnect = root.dispose;

    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(MockMutationObserver.instances).toHaveLength(1);
    expect(MockMutationObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not construct an observer when target resolution disposes the owner', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      useMutationObserver(() => {
        if (disposeOnRead) {
          dispose();
        }
        return element;
      })
    );
    dispose = root.dispose;
    disposeOnRead = true;

    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(MockMutationObserver.instances).toHaveLength(1);
  });

  it('stops resolving later targets after owner disposal', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    let laterReads = 0;
    const root = createRoot(() =>
      useMutationObserver([
        () => {
          if (disposeOnRead) {
            dispose();
          }
          return first;
        },
        () => {
          laterReads += 1;
          return second;
        }
      ])
    );
    dispose = root.dispose;
    expect(laterReads).toBe(1);
    disposeOnRead = true;

    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(laterReads).toBe(1);
    expect(MockMutationObserver.instances).toHaveLength(1);
  });

  it('skips the user callback when a records effect disposes the owner', () => {
    windowRef.MutationObserver = MockMutationObserver as never;
    const element = document.createElement('div');
    const callback = vi.fn();
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (Array.isArray(value) && value.length > 0) {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useMutationObserver(element, callback));
      dispose = root.dispose;

      MockMutationObserver.instances[0]!.trigger([
        { type: 'childList', target: element } as unknown as MutationRecord
      ]);

      expect(root.value.active()).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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
