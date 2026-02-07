import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { resolveTargetList, type MaybeElement } from '../internal/target';

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
    (windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver ??
    globalThis.ResizeObserver;
  const entries = createSignal<ResizeObserverEntry[]>([]);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(true);

  let cleanup = () => {};

  createEffect(() => {
    cleanup();

    if (!active()) {
      return;
    }

    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      return;
    }

    isSupported(true);
    const observer = new Observer(
      (nextEntries: ResizeObserverEntry[], currentObserver: ResizeObserver) => {
        entries(nextEntries);
        callback?.(nextEntries, currentObserver);
      }
    );

    const targets = resolveTargetList(target);
    for (const element of targets) {
      observer.observe(element, options.box ? { box: options.box } : undefined);
    }

    cleanup = () => {
      observer.disconnect();
      cleanup = () => {};
    };

    onCleanup(() => {
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
      cleanup();
    }
  };
}
