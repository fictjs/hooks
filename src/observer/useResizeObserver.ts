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
  refresh: () => void;
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
  const observerCtor = (windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)
    ?.ResizeObserver;
  const entries = createSignal<ResizeObserverEntry[]>([]);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(true);

  let cleanup = () => {};
  let cancelDeferredSetup = () => {};
  let setupReady = false;

  const setup = (): boolean => {
    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      setupReady = true;
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
      setupReady = false;
      cleanup = () => {};
    };
    setupReady = true;

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
      setupReady = false;
      setup();
    });
  };

  const refresh = () => {
    cancelDeferredSetup();
    cancelDeferredSetup = () => {};
    cleanup();
    setupReady = false;

    if (!active()) {
      return;
    }

    if (!setup()) {
      scheduleDeferredSetup();
    }
  };

  createEffect(() => {
    refresh();

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
      if (!active()) {
        active(true);
      } else if (!setupReady) {
        refresh();
      }
    },
    stop() {
      active(false);
      cancelDeferredSetup();
      cancelDeferredSetup = () => {};
      cleanup();
      setupReady = false;
    },
    refresh
  };
}
