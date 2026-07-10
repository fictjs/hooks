import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { useEventListener } from '../event/useEventListener';
import { tryOnDestroy } from '../internal/lifecycle';

export interface UseWindowSizeOptions {
  window?: Window | null;
  initialWidth?: number;
  initialHeight?: number;
}

export interface UseWindowSizeReturn {
  width: () => number;
  height: () => number;
}

/**
 * Reactive window size state.
 *
 * @fictReturn { width: 'signal', height: 'signal' }
 */
export function useWindowSize(options: UseWindowSizeOptions = {}): UseWindowSizeReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;

  const width = createSignal(windowRef?.innerWidth ?? options.initialWidth ?? 0);
  const height = createSignal(windowRef?.innerHeight ?? options.initialHeight ?? 0);
  let updateGeneration = 0;
  let disposed = false;

  function update(): void {
    if (disposed || !windowRef) {
      return;
    }
    const currentGeneration = ++updateGeneration;
    const canCommit = () => !disposed && currentGeneration === updateGeneration;
    const nextWidth = windowRef.innerWidth;
    if (!canCommit()) {
      return;
    }
    width(nextWidth);
    if (!canCommit()) {
      return;
    }
    const nextHeight = windowRef.innerHeight;
    if (!canCommit()) {
      return;
    }
    height(nextHeight);
  }

  useEventListener(windowRef, 'resize', update, { passive: true });

  tryOnDestroy(() => {
    disposed = true;
    updateGeneration += 1;
  });

  if (windowRef) {
    update();
  }

  return {
    width,
    height
  };
}
