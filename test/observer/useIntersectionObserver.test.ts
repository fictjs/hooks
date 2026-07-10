import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionObserver } from '../../src/observer/useIntersectionObserver';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  static errorTarget: Element | undefined;
  static disconnectError: Error | undefined;
  static onDisconnect: (() => void) | undefined;
  static triggerDuringObserve = false;
  readonly observedTargets = new Set<Element>();

  readonly observe = vi.fn((target: Element) => {
    if (target === MockIntersectionObserver.errorTarget) {
      throw new Error('observe failed');
    }
    if (MockIntersectionObserver.triggerDuringObserve) {
      this.trigger([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry]);
    }
    this.observedTargets.add(target);
  });
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn(() => {
    this.observedTargets.clear();
    MockIntersectionObserver.onDisconnect?.();
    if (MockIntersectionObserver.disconnectError) {
      throw MockIntersectionObserver.disconnectError;
    }
  });

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
    MockIntersectionObserver.disconnectError = undefined;
    MockIntersectionObserver.onDisconnect = undefined;
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

  it('keeps the observer created by a refresh reentered from target resolution', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    let refreshOnRead = false;
    const controls = createRoot(() =>
      useIntersectionObserver(() => {
        if (refreshOnRead) {
          refreshOnRead = false;
          controls.refresh();
        }
        return element;
      })
    ).value;

    refreshOnRead = true;
    controls.refresh();

    expect(MockIntersectionObserver.instances).toHaveLength(2);
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledOnce();
    expect(MockIntersectionObserver.instances[1]!.disconnect).not.toHaveBeenCalled();

    controls.stop();
    expect(MockIntersectionObserver.instances[1]!.disconnect).toHaveBeenCalledOnce();
  });

  it('preserves an observer restarted from the active signal notification', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    let controls: ReturnType<typeof useIntersectionObserver>;
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
      controls = createRoot(() => useIntersectionObserver(element)).value;
      restart = true;
      controls.stop();

      expect(controls.active()).toBe(true);
      expect(MockIntersectionObserver.instances).toHaveLength(1);
      expect(MockIntersectionObserver.instances[0]!.disconnect).not.toHaveBeenCalled();

      controls.stop();
      expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledOnce();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('rolls back a stale registration completed after observe synchronously refreshes', () => {
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
    expect(MockIntersectionObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(2);
    expect(MockIntersectionObserver.instances[1]!.observedTargets).toEqual(new Set());
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenCalledTimes(2);
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenNthCalledWith(1, first);
    expect(MockIntersectionObserver.instances[2]!.observe).toHaveBeenNthCalledWith(2, second);
    expect(MockIntersectionObserver.instances[2]!.disconnect).not.toHaveBeenCalled();
    expect(MockIntersectionObserver.instances[2]!.observedTargets).toEqual(
      new Set([first, second])
    );

    state.stop();
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(MockIntersectionObserver.instances[1]!.disconnect).toHaveBeenCalledTimes(2);
    expect(MockIntersectionObserver.instances[2]!.disconnect).toHaveBeenCalledTimes(1);
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

  it('preserves observe errors when rollback disconnect fails', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    MockIntersectionObserver.errorTarget = second;
    MockIntersectionObserver.disconnectError = new Error('disconnect failed');

    expect(() => createRoot(() => useIntersectionObserver([first, second]))).toThrow(
      'observe failed'
    );
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('finalizes cleanup state before disconnect throws', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    const state = createRoot(() => useIntersectionObserver(element)).value;
    MockIntersectionObserver.disconnectError = new Error('disconnect failed');

    expect(() => state.refresh()).toThrow('disconnect failed');
    expect(() => state.refresh()).not.toThrow();

    expect(MockIntersectionObserver.instances).toHaveLength(2);
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
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

  it('does not restart after owner disposal', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    const root = createRoot(() => useIntersectionObserver(element));

    root.dispose();
    root.value.start();
    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not continue refresh when disconnect disposes the owner', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    const root = createRoot(() => useIntersectionObserver(element));
    MockIntersectionObserver.onDisconnect = root.dispose;

    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not construct an observer when target resolution disposes the owner', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const element = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      useIntersectionObserver(() => {
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
    expect(MockIntersectionObserver.instances).toHaveLength(1);
  });

  it('stops resolving later targets after owner disposal', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
    const first = document.createElement('div');
    const second = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    let laterReads = 0;
    const root = createRoot(() =>
      useIntersectionObserver([
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
    expect(MockIntersectionObserver.instances).toHaveLength(1);
  });

  it('skips the user callback when an entries effect disposes the owner', () => {
    windowRef.IntersectionObserver = MockIntersectionObserver as never;
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
      const root = createRoot(() => useIntersectionObserver(element, callback));
      dispose = root.dispose;

      MockIntersectionObserver.instances[0]!.trigger([
        { isIntersecting: true, target: element } as unknown as IntersectionObserverEntry
      ]);

      expect(root.value.active()).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
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
