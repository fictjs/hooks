import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { deferTargetResolution, resolveTargetList, type MaybeElement } from '../internal/target';

export interface UseResizeObserverOptions {
  box?: ResizeObserverBoxOptions;
  window?: Window | null;
}

export interface UseResizeObserverReturn {
  entries: () => ResizeObserverEntry[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Observe element resize changes.
 *
 * @fictReturn { entries: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useResizeObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void,
  options: UseResizeObserverOptions = {}
): UseResizeObserverReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const observerCtor =
    options.window === undefined
      ? ((windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)
          ?.ResizeObserver ?? globalThis.ResizeObserver)
      : (windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver;
  const entries = createSignal<ResizeObserverEntry[]>([]);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(true);

  let cleanup = () => {};
  let cancelDeferredSetup = () => {};

  const setup = (): boolean => {
    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      return true;
    }

    const targets = resolveTargetList(target);
    if (targets.length === 0) {
      return false;
    }

    const observer = new Observer(
      (nextEntries: ResizeObserverEntry[], currentObserver: ResizeObserver) => {
        entries(nextEntries);
        callback?.(nextEntries, currentObserver);
      }
    );

    isSupported(true);
    for (const element of targets) {
      observer.observe(element, options.box ? { box: options.box } : undefined);
    }

    cleanup = () => {
      observer.disconnect();
      cleanup = () => {};
    };

    return true;
  };

  const scheduleDeferredSetup = () => {
    cancelDeferredSetup();
    cancelDeferredSetup = deferTargetResolution(() => {
      cancelDeferredSetup = () => {};
      if (!active()) {
        return;
      }
      cleanup();
      setup();
    });
  };

  createEffect(() => {
    cancelDeferredSetup();
    cancelDeferredSetup = () => {};
    cleanup();

    if (!active()) {
      return;
    }

    if (!setup()) {
      scheduleDeferredSetup();
    }

    onCleanup(() => {
      cancelDeferredSetup();
      cancelDeferredSetup = () => {};
      cleanup();
    });
  });

  return {
    entries,
    isSupported,
    active,
    start() {
      active(true);
    },
    stop() {
      active(false);
      cancelDeferredSetup();
      cancelDeferredSetup = () => {};
      cleanup();
    }
  };
}
