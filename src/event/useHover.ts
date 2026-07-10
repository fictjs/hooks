import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';
import { useEventListener } from './useEventListener';

export interface UseHoverOptions {
  initialValue?: boolean;
}

export interface UseHoverReturn {
  hovered: () => boolean;
  refresh: () => void;
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
  let operationGeneration = 0;
  let disposed = false;
  const ownsOperation = (operation: number) => !disposed && operation === operationGeneration;

  const enterListener = useEventListener(target, 'pointerenter', () => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    if (!ownsOperation(operation)) {
      return;
    }
    hovered(true);
  });
  const leaveListener = useEventListener(target, 'pointerleave', () => {
    if (disposed) {
      return;
    }
    const operation = ++operationGeneration;
    if (!ownsOperation(operation)) {
      return;
    }
    hovered(false);
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
      hovered(initialValue);
    }
  };

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
  });

  createEffect(() => syncTarget());

  return {
    hovered,
    refresh() {
      if (disposed) {
        return;
      }
      const operation = ++operationGeneration;
      syncTarget(operation);
      if (!ownsOperation(operation)) {
        return;
      }
      enterListener.refresh();
      if (!ownsOperation(operation)) {
        return;
      }
      leaveListener.refresh();
    }
  };
}
