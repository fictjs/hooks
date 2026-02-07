import { onDestroy } from '@fictjs/runtime';

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

  let timer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;
  let pending = false;

  const clearTimers = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = undefined;
    }
  };

  const invoke = () => {
    if (!lastArgs) {
      pending = false;
      clearTimers();
      return;
    }

    const args = lastArgs;
    lastArgs = undefined;
    pending = false;
    clearTimers();
    fn(...args);
  };

  const scheduleTimers = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      if (trailing) {
        invoke();
      } else {
        pending = false;
        clearTimers();
      }
    }, wait);

    if (maxWait != null && maxWait >= 0 && !maxTimer) {
      maxTimer = setTimeout(() => {
        invoke();
      }, maxWait);
    }
  };

  const run = (...args: Parameters<T>) => {
    const shouldCallLeading = leading && !timer;
    lastArgs = args;
    pending = true;

    if (shouldCallLeading) {
      fn(...args);
      if (!trailing) {
        lastArgs = undefined;
        pending = false;
      }
    }

    scheduleTimers();
  };

  const cancel = () => {
    pending = false;
    lastArgs = undefined;
    clearTimers();
  };

  const flush = () => {
    if (pending) {
      invoke();
    }
  };

  onDestroy(cancel);

  return {
    run,
    cancel,
    flush,
    pending: () => pending
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

  const schedule = () => {
    if (!trailing || !lastArgs) {
      pending = false;
      timer = undefined;
      return;
    }

    timer = setTimeout(() => {
      if (!lastArgs) {
        pending = false;
        timer = undefined;
        return;
      }
      const args = lastArgs;
      lastArgs = undefined;
      invoke(args);
      schedule();
    }, wait);
  };

  const run = (...args: Parameters<T>) => {
    if (!timer) {
      if (leading) {
        invoke(args);
      } else if (trailing) {
        lastArgs = args;
      }
      pending = !!lastArgs;
      timer = setTimeout(() => {
        timer = undefined;
        schedule();
      }, wait);
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

  onDestroy(cancel);

  return {
    run,
    cancel,
    flush,
    pending: () => pending
  };
}
