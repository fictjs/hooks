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
  let disposed = false;
  const canRequestFrame = () => !disposed && typeof windowRef?.requestAnimationFrame === 'function';
  const active = createSignal((options.immediate ?? true) && canRequestFrame());

  let rafId: number | undefined;
  const loopState = { generation: 0 };
  let requestGeneration = 0;
  let lastTimestamp: number | undefined;

  const markInactive = () => {
    loopState.generation += 1;
    requestGeneration += 1;
    lastTimestamp = undefined;
    rafId = undefined;
    active(false);
  };

  const schedule = (frameGeneration: number) => {
    if (disposed || frameGeneration !== loopState.generation) {
      return;
    }
    const currentRequestGeneration = ++requestGeneration;
    let nextRafId: number;
    try {
      nextRafId = windowRef!.requestAnimationFrame((timestamp) => {
        if (
          disposed ||
          currentRequestGeneration !== requestGeneration ||
          frameGeneration !== loopState.generation
        ) {
          return;
        }
        rafId = undefined;
        loop(timestamp, frameGeneration);
      });
    } catch (error) {
      if (frameGeneration === loopState.generation) {
        markInactive();
      }
      throw error;
    }
    if (
      disposed ||
      currentRequestGeneration !== requestGeneration ||
      frameGeneration !== loopState.generation ||
      !active()
    ) {
      try {
        windowRef?.cancelAnimationFrame?.(nextRafId);
      } catch {
        // Owner disposal makes this unowned frame best-effort cleanup.
      }
      return;
    }
    rafId = nextRafId;
  };

  const loop = (timestamp: number, frameGeneration: number) => {
    if (disposed || !active() || frameGeneration !== loopState.generation) {
      return;
    }

    const delta = lastTimestamp == null ? 0 : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    try {
      callback(delta, timestamp);
    } catch (error) {
      markInactive();
      throw error;
    }

    if (disposed || !active() || frameGeneration !== loopState.generation) {
      return;
    }

    const canSchedule = canRequestFrame();
    if (disposed || !active() || frameGeneration !== loopState.generation) {
      return;
    }
    if (canSchedule) {
      schedule(frameGeneration);
    } else {
      markInactive();
    }
  };

  const start = () => {
    if (disposed || active()) {
      return;
    }
    const canSchedule = canRequestFrame();
    if (disposed) {
      return;
    }
    if (!canSchedule) {
      active(false);
      return;
    }
    active(true);
    if (disposed || !active()) {
      return;
    }
    loopState.generation += 1;
    schedule(loopState.generation);
  };

  const stopLoop = () => {
    const currentRafId = rafId;
    markInactive();

    if (currentRafId !== undefined && windowRef?.cancelAnimationFrame) {
      windowRef.cancelAnimationFrame(currentRafId);
    }
  };

  const stop = () => {
    if (!disposed) {
      stopLoop();
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    stopLoop();
  });

  if (active()) {
    loopState.generation += 1;
    schedule(loopState.generation);
  }

  return {
    active,
    start,
    stop
  };
}
