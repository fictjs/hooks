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

function isTargetWithin(element: Element, target: EventTarget | null): boolean {
  if (!target) {
    return false;
  }

  try {
    return element.contains(target as Node);
  } catch {
    return false;
  }
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

    const relatedTarget = (event as FocusEvent).relatedTarget;
    if (isTargetWithin(targetElement, relatedTarget)) {
      return;
    }
    focused(false);
  });

  const syncTarget = () => {
    const currentTarget = resolveMaybeTarget(target);
    if (currentTarget !== previousTarget) {
      previousTarget = currentTarget;
      focused(initialValue);
    }
  };

  createEffect(syncTarget);

  return {
    focused,
    refresh() {
      syncTarget();
      focusInListener.refresh();
      focusOutListener.refresh();
    }
  };
}
