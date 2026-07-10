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
    lastArgs?: Parameters<T>;
  } = {
    timerScheduled: false,
    maxTimerScheduled: false
  };
  const pending = createSignal(false);

  const clearTimer = () => {
    if (!state.timerScheduled) {
      return;
    }
    const timer = state.timer;
    state.timer = undefined;
    state.timerScheduled = false;
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  };

  const clearMaxTimer = () => {
    if (!state.maxTimerScheduled) {
      return;
    }
    const maxTimer = state.maxTimer;
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
    if (!state.lastArgs) {
      pending(false);
      clearTimers();
      return;
    }

    const args = state.lastArgs;
    state.lastArgs = undefined;
    pending(false);
    clearTimers();
    fn(...args);
  };

  const scheduleTimers = (): boolean => {
    let firedSynchronously = false;

    if (state.timerScheduled) {
      clearTimer();
    }

    state.timerScheduled = true;
    let timer: ReturnType<typeof setTimeout>;
    try {
      timer = setTimeout(() => {
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
      state.timer = undefined;
      state.timerScheduled = false;
      throw error;
    }
    if (state.timerScheduled) {
      state.timer = timer;
    }

    if (trailing && maxWait != null && maxWait >= 0 && !state.maxTimerScheduled) {
      const effectiveMaxWait = Math.max(maxWait, wait);
      state.maxTimerScheduled = true;
      let maxTimer: ReturnType<typeof setTimeout>;
      try {
        maxTimer = setTimeout(() => {
          firedSynchronously = true;
          state.maxTimer = undefined;
          state.maxTimerScheduled = false;
          invoke();
        }, effectiveMaxWait);
      } catch (error) {
        state.maxTimer = undefined;
        state.maxTimerScheduled = false;
        throw error;
      }
      if (state.maxTimerScheduled) {
        state.maxTimer = maxTimer;
      }
    }

    return firedSynchronously;
  };

  const run = (...args: Parameters<T>) => {
    const shouldCallLeading = leading && !state.timerScheduled;
    if (trailing) {
      state.lastArgs = args;
      pending(true);
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

  const cancel = () => {
    pending(false);
    state.lastArgs = undefined;
    clearTimers();
  };

  const flush = () => {
    if (pending()) {
      invoke();
    }
  };

  tryOnDestroy(cancel);

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
  let lastArgs: Parameters<T> | undefined;
  const pending = createSignal(false);

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const tick = () => {
    timer = undefined;
    timerScheduled = false;
    if (trailing && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      scheduleTick();
      invoke(args);
      return;
    }

    pending(false);
  };

  const scheduleTick = () => {
    timerScheduled = true;
    let nextTimer: ReturnType<typeof setTimeout>;
    try {
      nextTimer = setTimeout(tick, wait);
    } catch (error) {
      timer = undefined;
      timerScheduled = false;
      throw error;
    }
    if (timerScheduled) {
      timer = nextTimer;
    }
  };

  const run = (...args: Parameters<T>) => {
    if (!timerScheduled) {
      if (!leading && trailing) {
        lastArgs = args;
        pending(true);
      }
      try {
        scheduleTick();
      } catch (error) {
        lastArgs = undefined;
        pending(false);
        throw error;
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

  const cancel = () => {
    const currentTimer = timer;
    const shouldClear = timerScheduled;
    timer = undefined;
    timerScheduled = false;
    lastArgs = undefined;
    pending(false);
    if (shouldClear) {
      clearTimeout(currentTimer as ReturnType<typeof setTimeout>);
    }
  };

  const flush = () => {
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      invoke(args);
    }
  };

  tryOnDestroy(cancel);

  return {
    run,
    cancel,
    flush,
    pending
  };
}
