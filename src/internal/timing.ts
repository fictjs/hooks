import { tryOnDestroy } from './lifecycle';

export type Procedure = (...args: unknown[]) => void;

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
    pending: boolean;
  } = {
    pending: false
  };

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
      state.pending = false;
      clearTimers();
      return;
    }

    const args = state.lastArgs;
    state.lastArgs = undefined;
    state.pending = false;
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
        state.pending = false;
        clearTimers();
      }
    }, wait);

    if (maxWait != null && maxWait >= 0 && !state.maxTimer) {
      state.maxTimer = setTimeout(() => {
        invoke();
      }, maxWait);
    }
  };

  const run = (...args: Parameters<T>) => {
    const shouldCallLeading = leading && !state.timer;
    state.lastArgs = args;
    state.pending = true;

    if (shouldCallLeading) {
      fn(...args);
      state.lastArgs = undefined;
      state.pending = false;
    }

    scheduleTimers();
  };

  const cancel = () => {
    state.pending = false;
    state.lastArgs = undefined;
    clearTimers();
  };

  const flush = () => {
    if (state.pending) {
      invoke();
    }
  };

  tryOnDestroy(cancel);

  return {
    run,
    cancel,
    flush,
    pending: () => state.pending
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
  let pending = false;

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const tick = () => {
    if (trailing && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending = false;
      invoke(args);
      timer = setTimeout(tick, wait);
      return;
    }

    timer = undefined;
    pending = false;
  };

  const run = (...args: Parameters<T>) => {
    if (!timer) {
      if (leading) {
        invoke(args);
      } else if (trailing) {
        lastArgs = args;
        pending = true;
      }
      timer = setTimeout(tick, wait);
      return;
    }

    if (trailing) {
      lastArgs = args;
      pending = true;
    }
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastArgs = undefined;
    pending = false;
  };

  const flush = () => {
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending = false;
      invoke(args);
    }
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  tryOnDestroy(cancel);

  return {
    run,
    cancel,
    flush,
    pending: () => pending
  };
}
