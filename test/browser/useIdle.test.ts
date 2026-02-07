import { createRoot } from '@fictjs/runtime';
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
