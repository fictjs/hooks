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
  const loopState = { generation: 0 };
  let lastTimestamp: number | undefined;

  const schedule = (frameGeneration: number) => {
    rafId = windowRef!.requestAnimationFrame((timestamp) => loop(timestamp, frameGeneration));
  };

  const loop = (timestamp: number, frameGeneration: number) => {
    if (!active() || frameGeneration !== loopState.generation) {
      return;
    }
    rafId = 0;

    const delta = lastTimestamp == null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    try {
      callback(delta, timestamp);
    } catch (error) {
      active(false);
      loopState.generation += 1;
      lastTimestamp = undefined;
      throw error;
    }

    if (!active() || frameGeneration !== loopState.generation) {
      return;
    }

    if (canRequestFrame()) {
      schedule(frameGeneration);
    } else {
      active(false);
      loopState.generation += 1;
      lastTimestamp = undefined;
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
    loopState.generation += 1;
    schedule(loopState.generation);
  };

  const stop = () => {
    active(false);
    loopState.generation += 1;
    lastTimestamp = undefined;

    if (rafId && windowRef?.cancelAnimationFrame) {
      windowRef.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  if (active()) {
    loopState.generation += 1;
    schedule(loopState.generation);
  }

  tryOnDestroy(stop);

  return {
    active,
    start,
    stop
  };
}
