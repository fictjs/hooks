import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIdle } from '../../src/browser/useIdle';

describe('useIdle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('becomes idle after timeout', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000
      })
    );

    expect(state.idle()).toBe(false);
    expect(state.active()).toBe(true);
    expect(state.lastActive()).toBe(Date.now());

    vi.advanceTimersByTime(999);
    expect(state.idle()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(state.idle()).toBe(true);
  });

  it('resets idle timer when activity event fires', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000
      })
    );

    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);

    windowRef.dispatchEvent(new Event('mousemove'));
    expect(state.idle()).toBe(false);

    vi.advanceTimersByTime(999);
    expect(state.idle()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(state.idle()).toBe(true);
  });

  it('supports pause and resume controls', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000
      })
    );

    state.pause();
    expect(state.active()).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(state.idle()).toBe(false);

    state.resume();
    expect(state.active()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);
  });

  it('routes direct active signal writes through pause and resume', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000
      })
    );

    (state.active as (next: boolean) => void)(false);
    expect(state.active()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(false);

    (state.active as (next: boolean) => void)(true);
    expect(state.active()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);
  });

  it('does not start when immediate is false', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;

    const { value: state } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000,
        immediate: false
      })
    );

    expect(state.active()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(state.idle()).toBe(false);

    state.resume();
    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);
  });

  it('stops timers and listeners on dispose', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;

    const { value: state, dispose } = createRoot(() =>
      useIdle({
        window: windowRef,
        timeout: 1000
      })
    );

    dispose();
    expect(state.active()).toBe(false);

    windowRef.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(2000);
    expect(state.idle()).toBe(false);
  });

  it('stops an activity operation when its idle write disposes the owner', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === false) {
          armed = false;
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useIdle({ window: windowRef, document: null, immediate: false, initialState: true })
      );
      dispose = root.dispose;
      armed = true;

      root.value.resume();

      expect(root.value.active()).toBe(false);
      expect(root.value.idle()).toBe(false);
      expect(root.value.lastActive()).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('invalidates a timer scheduled through a synchronous pause', () => {
    const windowRef = new EventTarget() as Window;
    const root = createRoot(() =>
      useIdle({ window: windowRef, document: null, immediate: false, initialState: false })
    );
    let scheduled = () => {};
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce((callback) => {
      scheduled = callback as () => void;
      root.value.pause();
      return 17 as unknown as ReturnType<typeof setTimeout>;
    });

    root.value.resume();
    scheduled();

    expect(setTimeoutSpy).toHaveBeenCalledOnce();
    expect(root.value.active()).toBe(false);
    expect(root.value.idle()).toBe(false);
    root.dispose();
  });

  it('treats becoming visible as user activity', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;
    const documentRef = new EventTarget() as Document;
    let visibilityState: DocumentVisibilityState = 'hidden';
    Object.defineProperty(documentRef, 'visibilityState', {
      configurable: true,
      get() {
        return visibilityState;
      }
    });
    const { value: state } = createRoot(() =>
      useIdle({ window: windowRef, document: documentRef, timeout: 1000 })
    );
    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);

    visibilityState = 'visible';
    documentRef.dispatchEvent(new Event('visibilitychange'));

    expect(state.idle()).toBe(false);
    expect(state.lastActive()).toBe(Date.now());
    vi.advanceTimersByTime(1000);
    expect(state.idle()).toBe(true);
  });

  it('resets while active and ignores controls after disposal', () => {
    vi.useFakeTimers();
    const windowRef = new EventTarget() as Window;
    const root = createRoot(() => useIdle({ window: windowRef, document: null, timeout: 1000 }));
    vi.advanceTimersByTime(1000);
    expect(root.value.idle()).toBe(true);

    root.value.reset();

    expect(root.value.idle()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    const lastActive = root.value.lastActive();
    root.dispose();
    root.value.pause();
    root.value.reset();
    root.value.resume();

    expect(root.value.active()).toBe(false);
    expect(root.value.lastActive()).toBe(lastActive);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports timeout implementations that invoke callbacks synchronously', () => {
    const windowRef = new EventTarget() as Window;
    const timeout = vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce((callback) => {
      (callback as () => void)();
      return 17 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      const root = createRoot(() =>
        useIdle({ window: windowRef, document: null, immediate: false, timeout: 1000 })
      );

      root.value.resume();

      expect(timeout).toHaveBeenCalled();
      expect(root.value.active()).toBe(true);
      expect(root.value.idle()).toBe(true);
      root.dispose();
    } finally {
      timeout.mockRestore();
    }
  });

  it('returns unsupported state when window is missing', () => {
    const { value: state } = createRoot(() =>
      useIdle({
        window: null
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(state.active()).toBe(false);
    state.resume();
    expect(state.active()).toBe(false);
  });
});
