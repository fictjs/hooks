import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';

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
  const active = createSignal(options.immediate ?? true);

  let rafId = 0;
  let lastTimestamp: number | undefined;

  const loop = (timestamp: number) => {
    if (!active()) {
      return;
    }

    const delta = lastTimestamp == null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    callback(delta, timestamp);

    if (windowRef?.requestAnimationFrame) {
      rafId = windowRef.requestAnimationFrame(loop);
    }
  };

  const start = () => {
    if (active()) {
      return;
    }
    active(true);
    if (windowRef?.requestAnimationFrame) {
      rafId = windowRef.requestAnimationFrame(loop);
    }
  };

  const stop = () => {
    active(false);
    lastTimestamp = undefined;

    if (rafId && windowRef?.cancelAnimationFrame) {
      windowRef.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  if (active() && windowRef?.requestAnimationFrame) {
    rafId = windowRef.requestAnimationFrame(loop);
  }

  onDestroy(stop);

  return {
    active,
    start,
    stop
  };
}
