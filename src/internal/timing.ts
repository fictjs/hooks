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
    lastArgs?: Parameters<T>;
  } = {};
  const pending = createSignal(false);

  const clearTimers = () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = undefined;
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

  const scheduleTimers = () => {
    if (state.timer) {
      clearTimeout(state.timer);
    }

    state.timer = setTimeout(() => {
      if (trailing) {
        invoke();
      } else {
        state.lastArgs = undefined;
        pending(false);
        clearTimers();
      }
    }, wait);

    if (trailing && maxWait != null && maxWait >= 0 && !state.maxTimer) {
      const effectiveMaxWait = Math.max(maxWait, wait);
      state.maxTimer = setTimeout(() => {
        invoke();
      }, effectiveMaxWait);
    }
  };

  const run = (...args: Parameters<T>) => {
    const shouldCallLeading = leading && !state.timer;
    state.lastArgs = args;
    pending(true);

    if (shouldCallLeading) {
      fn(...args);
      state.lastArgs = undefined;
      pending(false);
    }

    scheduleTimers();
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
  let lastArgs: Parameters<T> | undefined;
  const pending = createSignal(false);

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const tick = () => {
    if (trailing && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      timer = setTimeout(tick, wait);
      invoke(args);
      return;
    }

    timer = undefined;
    pending(false);
  };

  const run = (...args: Parameters<T>) => {
    if (!timer) {
      if (leading) {
        invoke(args);
      } else if (trailing) {
        lastArgs = args;
        pending(true);
      }
      timer = setTimeout(tick, wait);
      return;
    }

    if (trailing) {
      lastArgs = args;
      pending(true);
    }
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
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
