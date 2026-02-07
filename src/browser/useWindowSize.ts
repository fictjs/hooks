import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { useEventListener } from '../event/useEventListener';

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

  const update = () => {
    if (!windowRef) {
      return;
    }
    width(windowRef.innerWidth);
    height(windowRef.innerHeight);
  };

  useEventListener(windowRef, 'resize', update, { passive: true });

  if (windowRef) {
    update();
  }

  return {
    width,
    height
  };
}
