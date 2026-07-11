import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from './lifecycle';

export type Procedure = (...args: never[]) => void;

export interface ControlledFn<T extends Procedure> {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
}

export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export function createDebouncedFn<T extends Procedure>(
  fn: T,
  wait: number,
  options: DebounceOptions = {}
): ControlledFn<T> {
  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxWait = options.maxWait;

  const state: {
    timer?: ReturnType<typeof setTimeout>;
    maxTimer?: ReturnType<typeof setTimeout>;
    timerScheduled: boolean;
    maxTimerScheduled: boolean;
    timerGeneration: number;
    maxTimerGeneration: number;
    lastArgs?: Parameters<T>;
  } = {
    timerScheduled: false,
    maxTimerScheduled: false,
    timerGeneration: 0,
    maxTimerGeneration: 0
  };
  const pending = createSignal(false);
  let disposed = false;

  const clearTimer = () => {
    if (!state.timerScheduled) {
      return;
    }
    const timer = state.timer;
    state.timerGeneration += 1;
    state.timer = undefined;
    state.timerScheduled = false;
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  };

  const clearMaxTimer = () => {
    if (!state.maxTimerScheduled) {
      return;
    }
    const maxTimer = state.maxTimer;
    state.maxTimerGeneration += 1;
    state.maxTimer = undefined;
    state.maxTimerScheduled = false;
    clearTimeout(maxTimer as ReturnType<typeof setTimeout>);
  };

  const clearTimers = () => {
    let cleanupFailed = false;
    let cleanupError: unknown;
    try {
      clearTimer();
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
    try {
      clearMaxTimer();
    } catch (error) {
      if (!cleanupFailed) {
        cleanupFailed = true;
        cleanupError = error;
      }
    }
    if (cleanupFailed) {
      throw cleanupError;
    }
  };

  const invoke = () => {
    if (disposed) {
      return;
    }
    if (!state.lastArgs) {
      pending(false);
      clearTimers();
      return;
    }

    const args = state.lastArgs;
    state.lastArgs = undefined;
    pending(false);
    clearTimers();
    if (disposed) {
      return;
    }
    fn(...args);
  };

  const scheduleTimers = (): boolean => {
    let firedSynchronously = false;

    if (disposed) {
      return firedSynchronously;
    }

    if (state.timerScheduled) {
      clearTimer();
    }
    if (disposed) {
      return firedSynchronously;
    }

    state.timerScheduled = true;
    const timerGeneration = ++state.timerGeneration;
    let timer: ReturnType<typeof setTimeout>;
    try {
      timer = setTimeout(() => {
        if (disposed || timerGeneration !== state.timerGeneration || !state.timerScheduled) {
          return;
        }
        firedSynchronously = true;
        state.timer = undefined;
        state.timerScheduled = false;
        if (trailing) {
          invoke();
        } else {
          state.lastArgs = undefined;
          pending(false);
          clearTimers();
        }
      }, wait);
    } catch (error) {
      if (timerGeneration === state.timerGeneration) {
        state.timer = undefined;
        state.timerScheduled = false;
      }
      throw error;
    }
    if (disposed) {
      try {
        clearTimeout(timer);
      } catch {
        // Owner disposal makes this unowned timer best-effort cleanup.
      }
      return firedSynchronously;
    }
    if (timerGeneration === state.timerGeneration && state.timerScheduled) {
      state.timer = timer;
    }

    if (!disposed && trailing && maxWait != null && maxWait >= 0 && !state.maxTimerScheduled) {
      const effectiveMaxWait = Math.max(maxWait, wait);
      state.maxTimerScheduled = true;
      const maxTimerGeneration = ++state.maxTimerGeneration;
      let maxTimer: ReturnType<typeof setTimeout>;
      try {
        maxTimer = setTimeout(() => {
          if (
            disposed ||
            maxTimerGeneration !== state.maxTimerGeneration ||
            !state.maxTimerScheduled
          ) {
            return;
          }
          firedSynchronously = true;
          state.maxTimer = undefined;
          state.maxTimerScheduled = false;
          invoke();
        }, effectiveMaxWait);
      } catch (error) {
        if (maxTimerGeneration === state.maxTimerGeneration) {
          state.maxTimer = undefined;
          state.maxTimerScheduled = false;
        }
        throw error;
      }
      if (disposed) {
        try {
          clearTimeout(maxTimer);
        } catch {
          // Owner disposal makes this unowned timer best-effort cleanup.
        }
        return firedSynchronously;
      }
      if (maxTimerGeneration === state.maxTimerGeneration && state.maxTimerScheduled) {
        state.maxTimer = maxTimer;
      }
    }

    return firedSynchronously;
  };

  const run = (...args: Parameters<T>) => {
    if (disposed) {
      return;
    }
    const shouldCallLeading = leading && !state.timerScheduled;
    if (trailing) {
      state.lastArgs = args;
      pending(true);
      if (disposed) {
        state.lastArgs = undefined;
        return;
      }
    }
    let firedSynchronously: boolean;
    try {
      firedSynchronously = scheduleTimers();
    } catch (error) {
      state.lastArgs = undefined;
      pending(false);
      try {
        clearTimers();
      } catch {
        // Preserve the scheduling failure after best-effort rollback.
      }
      throw error;
    }

    if (disposed) {
      return;
    }

    if (shouldCallLeading && !(trailing && firedSynchronously)) {
      state.lastArgs = undefined;
      pending(false);
      try {
        fn(...args);
      } catch (error) {
        try {
          cancel();
        } catch {
          // Preserve the callback failure after best-effort cleanup.
        }
        throw error;
      }
    }
  };

  const cancelPending = () => {
    pending(false);
    state.lastArgs = undefined;
    clearTimers();
  };

  const cancel = () => {
    if (!disposed) {
      cancelPending();
    }
  };

  const flush = () => {
    if (!disposed && pending()) {
      invoke();
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    cancelPending();
  });

  return {
    run,
    cancel,
    flush,
    pending
  };
}

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function createThrottledFn<T extends Procedure>(
  fn: T,
  wait: number,
  options: ThrottleOptions = {}
): ControlledFn<T> {
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let timerScheduled = false;
  let timerGeneration = 0;
  let lastArgs: Parameters<T> | undefined;
  const pending = createSignal(false);
  let disposed = false;

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const tick = (generation: number) => {
    if (disposed || generation !== timerGeneration || !timerScheduled) {
      return;
    }
    timer = undefined;
    timerScheduled = false;
    if (trailing && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      if (disposed) {
        return;
      }
      scheduleTick();
      if (disposed) {
        return;
      }
      invoke(args);
      return;
    }

    pending(false);
  };

  const scheduleTick = () => {
    if (disposed) {
      return;
    }
    timerScheduled = true;
    const generation = ++timerGeneration;
    let nextTimer: ReturnType<typeof setTimeout>;
    try {
      nextTimer = setTimeout(() => tick(generation), wait);
    } catch (error) {
      if (generation === timerGeneration) {
        timer = undefined;
        timerScheduled = false;
      }
      throw error;
    }
    if (disposed) {
      try {
        clearTimeout(nextTimer);
      } catch {
        // Owner disposal makes this unowned timer best-effort cleanup.
      }
      return;
    }
    if (generation === timerGeneration && timerScheduled) {
      timer = nextTimer;
    }
  };

  const run = (...args: Parameters<T>) => {
    if (disposed) {
      return;
    }
    if (!timerScheduled) {
      if (!leading && trailing) {
        lastArgs = args;
        pending(true);
        if (disposed) {
          lastArgs = undefined;
          return;
        }
      }
      try {
        scheduleTick();
      } catch (error) {
        lastArgs = undefined;
        pending(false);
        throw error;
      }
      if (disposed) {
        return;
      }
      if (leading) {
        try {
          invoke(args);
        } catch (error) {
          try {
            cancel();
          } catch {
            // Preserve the callback failure after best-effort cleanup.
          }
          throw error;
        }
      }
      return;
    }

    if (trailing) {
      lastArgs = args;
      pending(true);
    }
  };

  const cancelPending = () => {
    const currentTimer = timer;
    const shouldClear = timerScheduled;
    timerGeneration += 1;
    timer = undefined;
    timerScheduled = false;
    lastArgs = undefined;
    pending(false);
    if (shouldClear) {
      clearTimeout(currentTimer as ReturnType<typeof setTimeout>);
    }
  };

  const cancel = () => {
    if (!disposed) {
      cancelPending();
    }
  };

  const flush = () => {
    if (!disposed && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      if (!disposed) {
        invoke(args);
      }
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    cancelPending();
  });

  return {
    run,
    cancel,
    flush,
    pending
  };
}
