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
  const observerCtor =
    options.window === undefined
      ? ((windowRef as (Window & { IntersectionObserver?: typeof IntersectionObserver }) | null)
          ?.IntersectionObserver ?? globalThis.IntersectionObserver)
      : (windowRef as (Window & { IntersectionObserver?: typeof IntersectionObserver }) | null)
          ?.IntersectionObserver;
  const entries = createSignal<IntersectionObserverEntry[]>([]);
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

    const rootElement = options.root ? resolveMaybeTarget(options.root) : undefined;
    const observer = new Observer(
      (nextEntries: IntersectionObserverEntry[], currentObserver: IntersectionObserver) => {
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
    for (const element of targets) {
      observer.observe(element);
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
    start() {
      active(true);
    },
    stop() {
      active(false);
      cancelDeferredSetup();
      cancelDeferredSetup = () => {};
      cleanup();
    },
    active
  };
}
