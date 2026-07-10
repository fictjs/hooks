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

  const clearTimers = () => {
    if (state.timerScheduled) {
      clearTimeout(state.timer as ReturnType<typeof setTimeout>);
      state.timer = undefined;
      state.timerScheduled = false;
    }
    if (state.maxTimerScheduled) {
      clearTimeout(state.maxTimer as ReturnType<typeof setTimeout>);
      state.maxTimer = undefined;
      state.maxTimerScheduled = false;
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
      clearTimeout(state.timer as ReturnType<typeof setTimeout>);
      state.timer = undefined;
      state.timerScheduled = false;
    }

    state.timerScheduled = true;
    const timer = setTimeout(() => {
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
    if (state.timerScheduled) {
      state.timer = timer;
    }

    if (trailing && maxWait != null && maxWait >= 0 && !state.maxTimerScheduled) {
      const effectiveMaxWait = Math.max(maxWait, wait);
      state.maxTimerScheduled = true;
      const maxTimer = setTimeout(() => {
        firedSynchronously = true;
        state.maxTimer = undefined;
        state.maxTimerScheduled = false;
        invoke();
      }, effectiveMaxWait);
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
    const firedSynchronously = scheduleTimers();

    if (shouldCallLeading && !(trailing && firedSynchronously)) {
      state.lastArgs = undefined;
      pending(false);
      try {
        fn(...args);
      } catch (error) {
        cancel();
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
    const nextTimer = setTimeout(tick, wait);
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
      scheduleTick();
      if (leading) {
        try {
          invoke(args);
        } catch (error) {
          cancel();
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
    if (timerScheduled) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      timer = undefined;
      timerScheduled = false;
    }
    lastArgs = undefined;
    pending(false);
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
