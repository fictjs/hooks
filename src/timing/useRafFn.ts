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

  let rafId: number | undefined;
  const loopState = { generation: 0 };
  let lastTimestamp: number | undefined;

  const markInactive = () => {
    active(false);
    loopState.generation += 1;
    lastTimestamp = undefined;
    rafId = undefined;
  };

  const schedule = (frameGeneration: number) => {
    try {
      rafId = windowRef!.requestAnimationFrame((timestamp) => loop(timestamp, frameGeneration));
    } catch (error) {
      if (frameGeneration === loopState.generation) {
        markInactive();
      }
      throw error;
    }
  };

  const loop = (timestamp: number, frameGeneration: number) => {
    if (!active() || frameGeneration !== loopState.generation) {
      return;
    }
    rafId = undefined;

    const delta = lastTimestamp == null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    try {
      callback(delta, timestamp);
    } catch (error) {
      markInactive();
      throw error;
    }

    if (!active() || frameGeneration !== loopState.generation) {
      return;
    }

    if (canRequestFrame()) {
      schedule(frameGeneration);
    } else {
      markInactive();
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
    const currentRafId = rafId;
    markInactive();

    if (currentRafId !== undefined && windowRef?.cancelAnimationFrame) {
      windowRef.cancelAnimationFrame(currentRafId);
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
