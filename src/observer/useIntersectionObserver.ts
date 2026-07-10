import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import {
  deferTargetResolution,
  resolveMaybeTarget,
  resolveTargetList,
  type MaybeElement,
  type MaybeTarget
} from '../internal/target';

export interface UseIntersectionObserverOptions extends Omit<IntersectionObserverInit, 'root'> {
  window?: Window | null;
  root?: MaybeTarget<Element>;
}

export interface UseIntersectionObserverReturn {
  entries: () => IntersectionObserverEntry[];
  isSupported: () => boolean;
  start: () => void;
  stop: () => void;
  refresh: () => void;
  active: () => boolean;
}

/**
 * Observe element intersection changes.
 *
 * @fictReturn { entries: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useIntersectionObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void,
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const observerCtor = (
    windowRef as (Window & { IntersectionObserver?: typeof IntersectionObserver }) | null
  )?.IntersectionObserver;
  const entries = createSignal<IntersectionObserverEntry[]>([]);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(true);

  let cleanup = () => {};
  let cancelDeferredSetup = () => {};
  let setupReady = false;
  let observerGeneration = 0;

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

    const rootElement = options.root ? resolveMaybeTarget(options.root) : undefined;
    const generation = ++observerGeneration;
    const observer = new Observer(
      (nextEntries: IntersectionObserverEntry[], currentObserver: IntersectionObserver) => {
        if (!active() || generation !== observerGeneration) {
          return;
        }
        entries(nextEntries);
        callback?.(nextEntries, currentObserver);
      },
      {
        root: rootElement ?? null,
        rootMargin: options.rootMargin,
        threshold: options.threshold
      }
    );

    isSupported(true);
    try {
      for (const element of targets) {
        observer.observe(element);
      }
    } catch (error) {
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      observer.disconnect();
      throw error;
    }

    cleanup = () => {
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
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
    refresh,
    active
  };
}
