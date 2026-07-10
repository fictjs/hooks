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
  let operationGeneration = 0;

  const ownsOperation = (operation: number) => operation === operationGeneration;

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

  const clearTimers = () => {
    const timer = state.timer;
    const maxTimer = state.maxTimer;
    const shouldClearTimer = state.timerScheduled;
    const shouldClearMaxTimer = state.maxTimerScheduled;

    if (shouldClearTimer) {
      state.timerGeneration += 1;
      state.timer = undefined;
      state.timerScheduled = false;
    }
    if (shouldClearMaxTimer) {
      state.maxTimerGeneration += 1;
      state.maxTimer = undefined;
      state.maxTimerScheduled = false;
    }

    let cleanupFailed = false;
    let cleanupError: unknown;
    if (shouldClearTimer) {
      try {
        clearTimeout(timer as ReturnType<typeof setTimeout>);
      } catch (error) {
        cleanupFailed = true;
        cleanupError = error;
      }
    }
    if (shouldClearMaxTimer) {
      try {
        clearTimeout(maxTimer as ReturnType<typeof setTimeout>);
      } catch (error) {
        if (!cleanupFailed) {
          cleanupFailed = true;
          cleanupError = error;
        }
      }
    }
    if (cleanupFailed) {
      throw cleanupError;
    }
  };

  const invoke = (operation: number) => {
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    if (!state.lastArgs) {
      try {
        clearTimers();
      } catch (error) {
        if (ownsOperation(operation)) {
          pending(false);
        }
        throw error;
      }
      if (disposed || !ownsOperation(operation)) {
        return;
      }
      pending(false);
      return;
    }

    const args = state.lastArgs;
    state.lastArgs = undefined;
    try {
      clearTimers();
    } catch (error) {
      if (ownsOperation(operation)) {
        pending(false);
      }
      throw error;
    }
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    pending(false);
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    fn(...args);
  };

  const scheduleTimers = (operation: number): boolean => {
    let firedSynchronously = false;

    if (disposed || !ownsOperation(operation)) {
      return firedSynchronously;
    }

    if (state.timerScheduled) {
      clearTimer();
    }
    if (disposed || !ownsOperation(operation)) {
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
        const callbackOperation = ++operationGeneration;
        firedSynchronously = true;
        state.timer = undefined;
        state.timerScheduled = false;
        if (trailing) {
          invoke(callbackOperation);
        } else {
          state.lastArgs = undefined;
          clearTimers();
          if (!disposed && ownsOperation(callbackOperation)) {
            pending(false);
          }
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
    if (!ownsOperation(operation)) {
      if (timerGeneration === state.timerGeneration && state.timerScheduled) {
        state.timerGeneration += 1;
        state.timerScheduled = false;
        try {
          clearTimeout(timer);
        } catch {
          // A superseding operation owns the live debounce state.
        }
      }
      return firedSynchronously;
    }
    if (timerGeneration === state.timerGeneration && state.timerScheduled) {
      state.timer = timer;
    }

    if (
      !disposed &&
      ownsOperation(operation) &&
      trailing &&
      maxWait != null &&
      maxWait >= 0 &&
      !state.maxTimerScheduled
    ) {
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
          const callbackOperation = ++operationGeneration;
          firedSynchronously = true;
          state.maxTimer = undefined;
          state.maxTimerScheduled = false;
          invoke(callbackOperation);
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
      if (!ownsOperation(operation)) {
        if (maxTimerGeneration === state.maxTimerGeneration && state.maxTimerScheduled) {
          state.maxTimerGeneration += 1;
          state.maxTimerScheduled = false;
          try {
            clearTimeout(maxTimer);
          } catch {
            // A superseding operation owns the live debounce state.
          }
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
    const operation = ++operationGeneration;
    const shouldCallLeading = leading && !state.timerScheduled;
    if (trailing) {
      state.lastArgs = args;
      pending(true);
      if (disposed || !ownsOperation(operation)) {
        return;
      }
    }
    let firedSynchronously: boolean;
    try {
      firedSynchronously = scheduleTimers(operation);
    } catch (error) {
      if (ownsOperation(operation)) {
        try {
          cancelPending(operation);
        } catch {
          // Preserve the scheduling failure after best-effort rollback.
        }
      }
      throw error;
    }

    if (disposed || !ownsOperation(operation)) {
      return;
    }

    if (shouldCallLeading && !(trailing && firedSynchronously)) {
      state.lastArgs = undefined;
      pending(false);
      if (disposed || !ownsOperation(operation)) {
        return;
      }
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

  const cancelPending = (operation: number) => {
    state.lastArgs = undefined;
    try {
      clearTimers();
    } catch (error) {
      if (ownsOperation(operation)) {
        pending(false);
      }
      throw error;
    }
    if (ownsOperation(operation)) {
      pending(false);
    }
  };

  const cancel = () => {
    if (!disposed) {
      const operation = ++operationGeneration;
      cancelPending(operation);
    }
  };

  const flush = () => {
    if (!disposed && pending()) {
      const operation = ++operationGeneration;
      invoke(operation);
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    const operation = ++operationGeneration;
    cancelPending(operation);
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
  let operationGeneration = 0;

  const ownsOperation = (operation: number) => operation === operationGeneration;

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const tick = (generation: number, synchronousOperation?: number) => {
    if (disposed || generation !== timerGeneration || !timerScheduled) {
      return;
    }
    const operation =
      synchronousOperation !== undefined && ownsOperation(synchronousOperation)
        ? synchronousOperation
        : ++operationGeneration;
    timer = undefined;
    timerScheduled = false;
    if (trailing && lastArgs) {
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      if (disposed || !ownsOperation(operation)) {
        return;
      }
      scheduleTick(operation);
      if (disposed || !ownsOperation(operation)) {
        return;
      }
      invoke(args);
      return;
    }

    pending(false);
  };

  const scheduleTick = (operation: number) => {
    if (disposed || !ownsOperation(operation)) {
      return;
    }
    timerScheduled = true;
    const generation = ++timerGeneration;
    let nextTimer: ReturnType<typeof setTimeout>;
    let scheduling = true;
    try {
      nextTimer = setTimeout(() => tick(generation, scheduling ? operation : undefined), wait);
    } catch (error) {
      if (generation === timerGeneration) {
        timer = undefined;
        timerScheduled = false;
      }
      throw error;
    } finally {
      scheduling = false;
    }
    if (disposed) {
      try {
        clearTimeout(nextTimer);
      } catch {
        // Owner disposal makes this unowned timer best-effort cleanup.
      }
      return;
    }
    if (!ownsOperation(operation)) {
      if (generation === timerGeneration && timerScheduled) {
        timerGeneration += 1;
        timerScheduled = false;
        try {
          clearTimeout(nextTimer);
        } catch {
          // A superseding operation owns the live throttle state.
        }
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
    const operation = ++operationGeneration;
    if (!timerScheduled) {
      if (!leading && trailing) {
        lastArgs = args;
        pending(true);
        if (disposed || !ownsOperation(operation)) {
          return;
        }
      }
      try {
        scheduleTick(operation);
      } catch (error) {
        if (ownsOperation(operation)) {
          lastArgs = undefined;
          pending(false);
        }
        throw error;
      }
      if (disposed || !ownsOperation(operation)) {
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
      operationGeneration += 1;
      cancelPending();
    }
  };

  const flush = () => {
    if (!disposed && lastArgs) {
      const operation = ++operationGeneration;
      const args = lastArgs;
      lastArgs = undefined;
      pending(false);
      if (!disposed && ownsOperation(operation)) {
        invoke(args);
      }
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
    cancelPending();
  });

  return {
    run,
    cancel,
    flush,
    pending
  };
}
