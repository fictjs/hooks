import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultDocument, defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

const DEFAULT_IDLE_EVENTS = [
  'mousemove',
  'mousedown',
  'resize',
  'keydown',
  'touchstart',
  'wheel',
  'pointerdown'
] as const;

export interface UseIdleOptions {
  timeout?: number;
  window?: Window | null;
  document?: Document | null;
  events?: Array<(typeof DEFAULT_IDLE_EVENTS)[number] | string>;
  listenForVisibilityChange?: boolean;
  immediate?: boolean;
  initialState?: boolean;
}

export interface UseIdleReturn {
  idle: () => boolean;
  lastActive: () => number | null;
  isSupported: () => boolean;
  active: () => boolean;
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Track user idle state using activity events + timer.
 *
 * @fictReturn { idle: 'signal', lastActive: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useIdle(options: UseIdleOptions = {}): UseIdleReturn {
  const timeout = options.timeout ?? 60_000;
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const events = options.events ?? [...DEFAULT_IDLE_EVENTS];
  const listenForVisibilityChange = options.listenForVisibilityChange ?? true;

  const idle = createSignal(options.initialState ?? false);
  const lastActive = createSignal<number | null>(null);
  const isSupported = createSignal(!!windowRef);
  const activeSignal = createSignal(false);
  const active = function active(next?: boolean) {
    if (arguments.length === 0) {
      return activeSignal();
    }
    if (next) {
      resume();
    } else {
      pause();
    }
  } as typeof activeSignal;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let operation = 0;
  let disposed = false;

  const isCurrentOperation = (currentOperation: number) =>
    !disposed && currentOperation === operation;

  const clearTimer = () => {
    if (timer == null) {
      return;
    }
    const currentTimer = timer;
    timer = null;
    clearTimeout(currentTimer);
  };

  const scheduleIdle = (currentOperation: number) => {
    clearTimer();
    if (!isCurrentOperation(currentOperation) || !activeSignal() || !isSupported()) {
      return;
    }

    let fired = false;
    let nextTimer: ReturnType<typeof setTimeout> | null = null;
    nextTimer = setTimeout(() => {
      fired = true;
      if (nextTimer != null && timer === nextTimer) {
        timer = null;
      }
      if (!isCurrentOperation(currentOperation) || !activeSignal()) {
        return;
      }
      idle(true);
    }, timeout);
    if (fired) {
      return;
    }
    if (!isCurrentOperation(currentOperation) || !activeSignal()) {
      clearTimeout(nextTimer);
      return;
    }
    timer = nextTimer;
  };

  const markActive = (currentOperation: number) => {
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    idle(false);
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    const timestamp = Date.now();
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    lastActive(timestamp);
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    scheduleIdle(currentOperation);
  };

  const activityListener = useEventListener(
    windowRef,
    events,
    () => {
      if (disposed || !activeSignal()) {
        return;
      }
      const currentOperation = ++operation;
      markActive(currentOperation);
    },
    {
      passive: true,
      immediate: false
    }
  );

  const visibilityListener = useEventListener(
    documentRef,
    'visibilitychange',
    () => {
      if (disposed || !activeSignal() || !documentRef) {
        return;
      }
      const currentOperation = operation;
      const visibilityState = documentRef.visibilityState;
      if (!isCurrentOperation(currentOperation) || visibilityState !== 'visible') {
        return;
      }
      const activityOperation = ++operation;
      markActive(activityOperation);
    },
    {
      passive: true,
      immediate: false
    }
  );

  const pause = () => {
    if (disposed) {
      return;
    }

    const currentOperation = ++operation;
    if (activeSignal()) {
      activeSignal(false);
      if (!isCurrentOperation(currentOperation)) {
        return;
      }
    }
    activityListener.stop();
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    visibilityListener.stop();
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    clearTimer();
  };

  const resume = () => {
    if (disposed || !windowRef || activeSignal()) {
      if (!windowRef) {
        isSupported(false);
      }
      return;
    }

    const currentOperation = ++operation;
    isSupported(true);
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    activeSignal(true);
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    activityListener.start();
    if (!isCurrentOperation(currentOperation)) {
      return;
    }
    if (listenForVisibilityChange) {
      visibilityListener.start();
      if (!isCurrentOperation(currentOperation)) {
        return;
      }
    }
    markActive(currentOperation);
  };

  const reset = () => {
    if (disposed) {
      return;
    }
    const currentOperation = ++operation;
    markActive(currentOperation);
  };

  if (options.immediate ?? true) {
    resume();
  }

  tryOnDestroy(() => {
    disposed = true;
    operation += 1;
    activeSignal(false);
    activityListener.stop();
    visibilityListener.stop();
    clearTimer();
  });

  return {
    idle,
    lastActive,
    isSupported,
    active,
    reset,
    pause,
    resume
  };
}
