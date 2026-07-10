import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
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

    const targets = resolveTargetList(target, () => canRunSetup(refreshId));
    if (!canRunSetup(refreshId)) {
      return true;
    }
    if (targets.length === 0) {
      return false;
    }

    const observeOptions: MutationObserverInit = {
      subtree: options.subtree ?? true,
      childList: options.childList ?? true,
      attributes: options.attributes,
      characterData: options.characterData,
      attributeFilter: options.attributeFilter,
      attributeOldValue: options.attributeOldValue,
      characterDataOldValue: options.characterDataOldValue
    };
    if (!canRunSetup(refreshId)) {
      return true;
    }

    const generation = ++observerGeneration;
    const observer = new Observer(
      (nextRecords: MutationRecord[], currentObserver: MutationObserver) => {
        if (!canObserve() || generation !== observerGeneration) {
          return;
        }
        records(nextRecords);
        if (!canObserve() || generation !== observerGeneration) {
          return;
        }
        callback?.(nextRecords, currentObserver);
      }
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
        observer.observe(element, observeOptions);
        if (
          !canRunSetup(refreshId) ||
          generation !== observerGeneration ||
          cleanup !== cleanupObserver
        ) {
          disconnectUnowned();
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
    records,
    isSupported,
    active,
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
    refresh
  };
}
