import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { deferTargetResolution, resolveTargetList, type MaybeElement } from '../internal/target';

export interface UseMutationObserverOptions extends MutationObserverInit {
  window?: Window | null;
}

export interface UseMutationObserverReturn {
  records: () => MutationRecord[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
  refresh: () => void;
}

/**
 * Observe DOM mutations for target elements.
 *
 * @fictReturn { records: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useMutationObserver(
  target: MaybeElement | MaybeElement[],
  callback?: (records: MutationRecord[], observer: MutationObserver) => void,
  options: UseMutationObserverOptions = {}
): UseMutationObserverReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const observerCtor = (
    windowRef as (Window & { MutationObserver?: typeof MutationObserver }) | null
  )?.MutationObserver;
  const records = createSignal<MutationRecord[]>([]);
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

    const generation = ++observerGeneration;
    const observer = new Observer(
      (nextRecords: MutationRecord[], currentObserver: MutationObserver) => {
        if (!active() || generation !== observerGeneration) {
          return;
        }
        records(nextRecords);
        callback?.(nextRecords, currentObserver);
      }
    );

    const observeOptions: MutationObserverInit = {
      subtree: options.subtree ?? true,
      childList: options.childList ?? true,
      attributes: options.attributes,
      characterData: options.characterData,
      attributeFilter: options.attributeFilter,
      attributeOldValue: options.attributeOldValue,
      characterDataOldValue: options.characterDataOldValue
    };

    isSupported(true);
    let cleanupObserver = () => {};
    cleanupObserver = () => {
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      observer.disconnect();
      if (cleanup === cleanupObserver) {
        setupReady = false;
        cleanup = () => {};
      }
    };
    cleanup = cleanupObserver;
    setupReady = true;

    try {
      for (const element of targets) {
        observer.observe(element, observeOptions);
        if (generation !== observerGeneration || cleanup !== cleanupObserver) {
          return true;
        }
      }
    } catch (error) {
      cleanupObserver();
      throw error;
    }

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
    records,
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
