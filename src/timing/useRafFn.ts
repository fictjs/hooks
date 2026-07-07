import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

export interface UseRafFnOptions {
  immediate?: boolean;
  window?: Window | null;
}

export interface UseRafFnReturn {
  active: () => boolean;
  start: () => void;
  stop: () => void;
}

/**
 * requestAnimationFrame loop helper.
 *
 * @fictReturn { active: 'signal' }
 */
export function useRafFn(
  callback: (delta: number, timestamp: number) => void,
  options: UseRafFnOptions = {}
): UseRafFnReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const canRequestFrame = () => typeof windowRef?.requestAnimationFrame === 'function';
  const active = createSignal((options.immediate ?? true) && canRequestFrame());

  let rafId = 0;
  let lastTimestamp: number | undefined;

  const loop = (timestamp: number) => {
    if (!active()) {
      return;
    }

    const delta = lastTimestamp == null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    try {
      callback(delta, timestamp);
    } catch (error) {
      active(false);
      lastTimestamp = undefined;
      throw error;
    }

    if (canRequestFrame()) {
      rafId = windowRef!.requestAnimationFrame(loop);
    } else {
      active(false);
    }
  };

  const start = () => {
    if (active()) {
      return;
    }
    if (!canRequestFrame()) {
      active(false);
      return;
    }
    active(true);
    rafId = windowRef!.requestAnimationFrame(loop);
  };

  const stop = () => {
    active(false);
    lastTimestamp = undefined;

    if (rafId && windowRef?.cancelAnimationFrame) {
      windowRef.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  if (active()) {
    rafId = windowRef!.requestAnimationFrame(loop);
  }

  tryOnDestroy(stop);

  return {
    active,
    start,
    stop
  };
}
