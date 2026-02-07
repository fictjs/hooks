import { defaultWindow } from '../internal/env';
import { useScroll, type UseScrollOptions, type UseScrollReturn } from './useScroll';

export interface UseWindowScrollOptions extends Omit<UseScrollOptions, 'target'> {
  window?: Window | null;
}

/**
 * Track scroll position for window only.
 *
 * @fictReturn { x: 'signal', y: 'signal' }
 */
export function useWindowScroll(options: UseWindowScrollOptions = {}): UseScrollReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  return useScroll({
    ...options,
    window: windowRef,
    target: windowRef
  });
}
