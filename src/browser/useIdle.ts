import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultDocument, defaultWindow } from '../internal/env';

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
  const active = createSignal(false);

  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer == null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  };

  const scheduleIdle = () => {
    clearTimer();
    if (!active() || !isSupported()) {
      return;
    }
    timer = setTimeout(() => {
      idle(true);
    }, timeout);
  };

  const markActive = () => {
    idle(false);
    lastActive(Date.now());
    scheduleIdle();
  };

  const activityListener = useEventListener(windowRef, events, markActive, {
    passive: true,
    immediate: false
  });

  const visibilityListener = useEventListener(
    documentRef,
    'visibilitychange',
    () => {
      if (!documentRef || documentRef.visibilityState !== 'visible') {
        return;
      }
      markActive();
    },
    {
      passive: true,
      immediate: false
    }
  );

  const pause = () => {
    if (!active()) {
      return;
    }

    active(false);
    activityListener.stop();
    visibilityListener.stop();
    clearTimer();
  };

  const resume = () => {
    if (!windowRef || active()) {
      if (!windowRef) {
        isSupported(false);
      }
      return;
    }

    isSupported(true);
    active(true);
    activityListener.start();
    if (listenForVisibilityChange) {
      visibilityListener.start();
    }
    markActive();
  };

  const reset = () => {
    markActive();
  };

  if (options.immediate ?? true) {
    resume();
  }

  onDestroy(() => {
    pause();
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
