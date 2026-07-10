import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
import { deferTargetResolution, resolveMaybeTarget, type MaybeTarget } from '../internal/target';

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface UseScrollOptions {
  target?: MaybeTarget<Element | Document | Window> | null;
  window?: Window | null;
  initialX?: number;
  initialY?: number;
  shouldUpdate?: (next: ScrollPosition, prev: ScrollPosition) => boolean;
  passive?: boolean;
  capture?: boolean;
}

export interface UseScrollReturn {
  x: () => number;
  y: () => number;
  refresh: () => void;
}

function isWindowLike(target: unknown): target is Window {
  if (!target || typeof target !== 'object') {
    return false;
  }
  return (
    ('pageXOffset' in target || 'scrollX' in target) &&
    ('pageYOffset' in target || 'scrollY' in target)
  );
}

function readDocumentScrollPosition(documentRef: Document, windowRef?: Window): ScrollPosition {
  const view = documentRef.defaultView ?? windowRef;
  if (view) {
    return {
      x: view.pageXOffset ?? view.scrollX ?? 0,
      y: view.pageYOffset ?? view.scrollY ?? 0
    };
  }

  const scrolling =
    documentRef.scrollingElement ??
    (documentRef.documentElement as Element | null) ??
    documentRef.body;
  return {
    x: scrolling?.scrollLeft ?? 0,
    y: scrolling?.scrollTop ?? 0
  };
}

function readScrollPosition(
  target: Element | Document | Window | undefined,
  windowRef: Window | null | undefined,
  fallback: ScrollPosition
): ScrollPosition {
  if (!target) {
    return fallback;
  }

  if ('documentElement' in target) {
    return readDocumentScrollPosition(target, windowRef ?? undefined);
  }

  if (isWindowLike(target)) {
    return {
      x: target.pageXOffset ?? target.scrollX ?? 0,
      y: target.pageYOffset ?? target.scrollY ?? 0
    };
  }

  return {
    x: target.scrollLeft ?? 0,
    y: target.scrollTop ?? 0
  };
}

/**
 * Track scroll position for window, document or element targets.
 *
 * @fictReturn { x: 'signal', y: 'signal' }
 */
export function useScroll(options: UseScrollOptions = {}): UseScrollReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const fallback = {
    x: options.initialX ?? 0,
    y: options.initialY ?? 0
  };

  const x = createSignal(fallback.x);
  const y = createSignal(fallback.y);
  const previous = { current: { ...fallback } };
  let cancelDeferredUpdate = () => {};
  let disposed = false;
  let updateGeneration = 0;

  const resolveScrollTarget = (): Element | Document | Window | undefined => {
    if (options.target === null) {
      return undefined;
    }
    if (options.target === undefined) {
      return windowRef ?? undefined;
    }
    return resolveMaybeTarget(options.target);
  };

  const update = () => {
    if (disposed) {
      return;
    }
    const operation = ++updateGeneration;
    const canCommit = () => !disposed && operation === updateGeneration;
    const nextTarget = resolveScrollTarget();
    if (!canCommit()) {
      return;
    }
    const next = readScrollPosition(nextTarget, windowRef, fallback);
    if (!canCommit()) {
      return;
    }
    const shouldUpdate = options.shouldUpdate?.(next, previous.current) ?? true;
    if (!canCommit() || !shouldUpdate) {
      return;
    }
    if (next.x === previous.current.x && next.y === previous.current.y) {
      return;
    }
    x(next.x);
    if (!canCommit()) {
      return;
    }
    y(next.y);
    if (!canCommit()) {
      return;
    }
    previous.current = next;
  };

  const scrollListener = useEventListener(
    () => {
      const nextTarget = resolveScrollTarget();
      return disposed ? undefined : (nextTarget as EventTarget | undefined);
    },
    'scroll',
    update,
    {
      passive: options.passive ?? true,
      capture: options.capture
    }
  );

  const scheduleDeferredUpdate = () => {
    if (disposed) {
      return;
    }
    cancelDeferredUpdate = deferTargetResolution(() => {
      cancelDeferredUpdate = () => {};
      if (disposed) {
        return;
      }
      scrollListener.refresh();
      if (disposed) {
        scrollListener.stop();
        return;
      }
      update();
      if (disposed) {
        scrollListener.stop();
      }
    });
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    cancelDeferredUpdate();
    cancelDeferredUpdate = () => {};
    scrollListener.refresh();
    if (disposed) {
      scrollListener.stop();
      return;
    }
    update();
    if (disposed) {
      scrollListener.stop();
      return;
    }
    const nextTarget = resolveScrollTarget();
    if (disposed) {
      scrollListener.stop();
      return;
    }
    if (!nextTarget) {
      scheduleDeferredUpdate();
    }
  };

  createEffect(() => {
    refresh();

    onCleanup(() => {
      cancelDeferredUpdate();
      cancelDeferredUpdate = () => {};
    });
  });

  tryOnDestroy(() => {
    disposed = true;
    updateGeneration += 1;
    cancelDeferredUpdate();
    cancelDeferredUpdate = () => {};
  });

  return {
    x,
    y,
    refresh
  };
}
