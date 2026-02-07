import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { resolveTargetList, type MaybeElement } from '../internal/target';

export interface UseMutationObserverOptions extends MutationObserverInit {
  window?: Window | null;
}

export interface UseMutationObserverReturn {
  records: () => MutationRecord[];
  isSupported: () => boolean;
  active: () => boolean;
  start: () => void;
  stop: () => void;
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
  const observerCtor =
    (windowRef as (Window & { MutationObserver?: typeof MutationObserver }) | null)
      ?.MutationObserver ?? globalThis.MutationObserver;
  const records = createSignal<MutationRecord[]>([]);
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
      (nextRecords: MutationRecord[], currentObserver: MutationObserver) => {
        records(nextRecords);
        callback?.(nextRecords, currentObserver);
      }
    );

    const targets = resolveTargetList(target);
    const observeOptions: MutationObserverInit = {
      subtree: options.subtree ?? true,
      childList: options.childList ?? true,
      attributes: options.attributes,
      characterData: options.characterData,
      attributeFilter: options.attributeFilter,
      attributeOldValue: options.attributeOldValue,
      characterDataOldValue: options.characterDataOldValue
    };

    for (const element of targets) {
      observer.observe(element, observeOptions);
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
    records,
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
