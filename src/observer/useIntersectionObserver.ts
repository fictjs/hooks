import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import {
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
  const entries = createSignal<IntersectionObserverEntry[]>([]);
  const isSupported = createSignal(!!windowRef?.IntersectionObserver);
  const active = createSignal(true);

  let cleanup = () => {};

  const setup = () => {
    if (!windowRef?.IntersectionObserver) {
      isSupported(false);
      return;
    }

    isSupported(true);

    const rootElement = options.root ? resolveMaybeTarget(options.root) : undefined;
    const observer = new windowRef.IntersectionObserver(
      (nextEntries, currentObserver) => {
        entries(nextEntries);
        callback?.(nextEntries, currentObserver);
      },
      {
        root: rootElement ?? null,
        rootMargin: options.rootMargin,
        threshold: options.threshold
      }
    );

    const targets = resolveTargetList(target);
    for (const element of targets) {
      observer.observe(element);
    }

    cleanup = () => {
      observer.disconnect();
      cleanup = () => {};
    };
  };

  createEffect(() => {
    cleanup();

    if (!active()) {
      return;
    }

    setup();

    onCleanup(() => {
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
      cleanup();
    },
    active
  };
}
