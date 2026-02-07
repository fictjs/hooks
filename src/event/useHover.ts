import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';
import { useEventListener } from './useEventListener';

export interface UseHoverOptions {
  initialValue?: boolean;
}

export interface UseHoverReturn {
  hovered: () => boolean;
}

/**
 * Track hover state for an element target.
 *
 * @fictReturn { hovered: 'signal' }
 */
export function useHover(target: MaybeElement, options: UseHoverOptions = {}): UseHoverReturn {
  const initialValue = options.initialValue ?? false;
  const hovered = createSignal(initialValue);
  let previousTarget: Element | undefined;

  useEventListener(target, 'pointerenter', () => {
    hovered(true);
  });
  useEventListener(target, 'pointerleave', () => {
    hovered(false);
  });

  createEffect(() => {
    const currentTarget = resolveMaybeTarget(target);
    if (currentTarget !== previousTarget) {
      previousTarget = currentTarget;
      hovered(initialValue);
    }
  });

  return { hovered };
}
