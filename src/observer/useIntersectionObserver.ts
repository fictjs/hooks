import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
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
  let refreshGeneration = 0;
  let controlGeneration = 0;
  let disposed = false;
  const canObserve = () => !disposed && active();
  const ownsControl = (generation: number) => !disposed && generation === controlGeneration;
  const ownsRefresh = (generation: number) => !disposed && generation === refreshGeneration;
  const canRunSetup = (generation: number) => ownsRefresh(generation) && active();

  const setup = (refreshId: number): boolean => {
    if (!canRunSetup(refreshId)) {
      return true;
    }
    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      if (!canRunSetup(refreshId)) {
        return true;
      }
      setupReady = true;
      return true;
    }

    const targets = resolveTargetList(target);
    if (!canRunSetup(refreshId)) {
      return true;
    }
    if (targets.length === 0) {
      return false;
    }

    const rootElement = options.root ? resolveMaybeTarget(options.root) : undefined;
    if (!canRunSetup(refreshId)) {
      return true;
    }
    const observerOptions: IntersectionObserverInit = {
      root: rootElement ?? null,
      rootMargin: options.rootMargin,
      threshold: options.threshold
    };
    if (!canRunSetup(refreshId)) {
      return true;
    }
    const generation = ++observerGeneration;
    const observer = new Observer(
      (nextEntries: IntersectionObserverEntry[], currentObserver: IntersectionObserver) => {
        if (!canObserve() || generation !== observerGeneration) {
          return;
        }
        entries(nextEntries);
        if (!canObserve() || generation !== observerGeneration) {
          return;
        }
        callback?.(nextEntries, currentObserver);
      },
      observerOptions
    );

    const disconnectUnowned = () => {
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      try {
        observer.disconnect();
      } catch {
        // A terminal or superseded setup has no owner to report cleanup failures to.
      }
    };

    if (!canRunSetup(refreshId) || generation !== observerGeneration) {
      disconnectUnowned();
      return true;
    }

    isSupported(true);
    if (!canRunSetup(refreshId) || generation !== observerGeneration) {
      disconnectUnowned();
      return true;
    }
    let cleanupObserver = () => {};
    cleanupObserver = () => {
      const ownsSetup = cleanup === cleanupObserver;
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      if (ownsSetup) {
        setupReady = false;
        cleanup = () => {};
      }
      observer.disconnect();
    };
    cleanup = cleanupObserver;
    setupReady = true;

    try {
      for (const element of targets) {
        if (
          !canRunSetup(refreshId) ||
          generation !== observerGeneration ||
          cleanup !== cleanupObserver
        ) {
          return true;
        }
        observer.observe(element);
        if (
          !canRunSetup(refreshId) ||
          generation !== observerGeneration ||
          cleanup !== cleanupObserver
        ) {
          return true;
        }
      }
    } catch (error) {
      try {
        cleanupObserver();
      } catch {
        // Preserve the observation failure after best-effort rollback.
      }
      throw error;
    }

    return true;
  };

  const scheduleDeferredSetup = (refreshId: number) => {
    cancelDeferredSetup();
    if (!canRunSetup(refreshId)) {
      return;
    }
    cancelDeferredSetup = deferTargetResolution(() => {
      cancelDeferredSetup = () => {};
      if (!canRunSetup(refreshId)) {
        return;
      }
      cleanup();
      if (!canRunSetup(refreshId)) {
        return;
      }
      setupReady = false;
      setup(refreshId);
    });
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    const refreshId = ++refreshGeneration;
    cancelDeferredSetup();
    cancelDeferredSetup = () => {};
    if (!ownsRefresh(refreshId)) {
      return;
    }
    cleanup();
    if (!ownsRefresh(refreshId)) {
      return;
    }
    setupReady = false;

    if (!canObserve()) {
      return;
    }

    if (!setup(refreshId) && canRunSetup(refreshId)) {
      scheduleDeferredSetup(refreshId);
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

  tryOnDestroy(() => {
    disposed = true;
    controlGeneration += 1;
    active(false);
    cancelDeferredSetup();
    cancelDeferredSetup = () => {};
    setupReady = false;
    cleanup();
  });

  return {
    entries,
    isSupported,
    start() {
      if (disposed) {
        return;
      }
      const controlId = ++controlGeneration;
      if (!active()) {
        active(true);
      } else if (!setupReady) {
        refresh();
      }
      if (!ownsControl(controlId)) {
        return;
      }
    },
    stop() {
      if (disposed) {
        return;
      }
      const controlId = ++controlGeneration;
      active(false);
      if (!ownsControl(controlId)) {
        return;
      }
      cancelDeferredSetup();
      cancelDeferredSetup = () => {};
      cleanup();
      setupReady = false;
    },
    refresh,
    active
  };
}
