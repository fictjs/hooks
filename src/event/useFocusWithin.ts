import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';
import { useEventListener } from './useEventListener';

export interface UseFocusWithinOptions {
  initialValue?: boolean;
}

export interface UseFocusWithinReturn {
  focused: () => boolean;
  refresh: () => void;
}

/**
 * Track whether focus is currently inside a target element.
 *
 * @fictReturn { focused: 'signal' }
 */
export function useFocusWithin(
  target: MaybeElement,
  options: UseFocusWithinOptions = {}
): UseFocusWithinReturn {
  const initialValue = options.initialValue ?? false;
  const focused = createSignal(initialValue);
  let previousTarget: Element | undefined;

  const focusInListener = useEventListener(target, 'focusin', () => {
    focused(true);
  });

  const focusOutListener = useEventListener(target, 'focusout', (event) => {
    const targetElement = resolveMaybeTarget(target);
    if (!targetElement) {
      focused(false);
      return;
    }

    const relatedTarget = (event as FocusEvent).relatedTarget as Node | null;
    if (relatedTarget && targetElement.contains(relatedTarget)) {
      return;
    }
    focused(false);
  });

  createEffect(() => {
    const currentTarget = resolveMaybeTarget(target);
    if (currentTarget !== previousTarget) {
      previousTarget = currentTarget;
      focused(initialValue);
    }
  });

  return {
    focused,
    refresh() {
      focusInListener.refresh();
      focusOutListener.refresh();
    }
  };
}
