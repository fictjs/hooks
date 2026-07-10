import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';
import { useEventListener } from './useEventListener';

export interface UseFocusWithinOptions {
  initialValue?: boolean;
}

export interface UseFocusWithinReturn {
  focused: () => boolean;
  refresh: () => void;
}

function isTargetWithin(
  element: Element,
  target: EventTarget | null,
  ownsOperation: () => boolean
): boolean {
  if (!ownsOperation() || !target) {
    return false;
  }

  try {
    const within = element.contains(target as Node);
    return ownsOperation() && within;
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
  let operationGeneration = 0;
  let disposed = false;
  const ownsOperation = (operation: number) => !disposed && operation === operationGeneration;

  const focusInListener = useEventListener(target, 'focusin', () => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    if (!ownsOperation(operation)) {
      return;
    }
    focused(true);
  });

  const focusOutListener = useEventListener(target, 'focusout', (event) => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    const isCurrent = () => ownsOperation(operation);
    const targetElement = resolveMaybeTarget(target);
    if (!isCurrent()) {
      return;
    }
    if (!targetElement) {
      focused(false);
      return;
    }

    const relatedTarget = (event as FocusEvent).relatedTarget;
    if (!isCurrent()) {
      return;
    }
    const within = isTargetWithin(targetElement, relatedTarget, isCurrent);
    if (!isCurrent() || within) {
      return;
    }
    focused(false);
  });

  const syncTarget = (operation = ++operationGeneration) => {
    if (!ownsOperation(operation)) {
      return;
    }
    const currentTarget = resolveMaybeTarget(target);
    if (!ownsOperation(operation)) {
      return;
    }
    if (currentTarget !== previousTarget) {
      previousTarget = currentTarget;
      focused(initialValue);
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
  });

  createEffect(() => syncTarget());

  return {
    focused,
    refresh() {
      if (disposed) {
        return;
      }
      const operation = ++operationGeneration;
      syncTarget(operation);
      if (!ownsOperation(operation)) {
        return;
      }
      focusInListener.refresh();
      if (!ownsOperation(operation)) {
        return;
      }
      focusOutListener.refresh();
    }
  };
}
