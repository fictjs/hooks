import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { addEventListeners, type EventName, type UseEventListenerOptions } from '../internal/event';
import { tryOnDestroy } from '../internal/lifecycle';
import { deferTargetResolution, resolveTargetList, type MaybeTarget } from '../internal/target';
import { toArray, toValue, type MaybeAccessor } from '../internal/value';

export interface UseEventListenerControls {
  start: () => void;
  stop: () => void;
  refresh: () => void;
  active: () => boolean;
}

/**
 * Bind event listeners with automatic teardown.
 *
 * @fictReturn { active: 'signal' }
 */
export function useEventListener<E extends Event = Event>(
  target: MaybeTarget<EventTarget> | Array<MaybeTarget<EventTarget>>,
  event: EventName | MaybeAccessor<EventName>,
  handler: (event: E) => void,
  options: UseEventListenerOptions = {}
): UseEventListenerControls {
  const active = createSignal(options.immediate ?? true);
  let stopCurrent = () => {};
  let cancelDeferredBind = () => {};
  let bound = false;
  let disposed = false;
  let bindingGeneration = 0;
  let refreshGeneration = 0;
  let controlGeneration = 0;

  const canBind = () => !disposed && active();
  const ownsControl = (generation: number) => !disposed && generation === controlGeneration;
  const ownsRefresh = (generation: number) => !disposed && generation === refreshGeneration;
  const canRunBind = (generation: number) => ownsRefresh(generation) && active();

  const bind = (refreshId: number): (() => void) | undefined => {
    const targets = resolveTargetList(target);
    if (!canRunBind(refreshId)) {
      return undefined;
    }
    const eventNames = toArray(toValue(event as MaybeAccessor<EventName>));
    if (!canRunBind(refreshId)) {
      return undefined;
    }

    if (targets.length === 0 || eventNames.length === 0) {
      return undefined;
    }

    const generation = ++bindingGeneration;
    const listener = (eventObject: Event) => {
      if (canBind() && generation === bindingGeneration) {
        handler(eventObject as E);
      }
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: options.capture,
      once: options.once,
      passive: options.passive,
      signal: options.signal
    };
    if (!canRunBind(refreshId) || generation !== bindingGeneration) {
      return undefined;
    }
    const controller = addEventListeners(targets, eventNames, listener, listenerOptions);
    const stop = () => {
      if (generation === bindingGeneration) {
        bindingGeneration += 1;
      }
      controller.stop();
    };
    if (!canRunBind(refreshId) || generation !== bindingGeneration) {
      try {
        stop();
      } catch {
        // Disposal owns no live binding, so cleanup is best-effort here.
      }
      return undefined;
    }
    return stop;
  };

  const applyStop = (stop: () => void) => {
    bound = true;
    stopCurrent = () => {
      bound = false;
      stopCurrent = () => {};
      stop();
    };
  };

  const bindCurrent = (refreshId: number): boolean => {
    const stop = bind(refreshId);
    if (!stop) {
      return false;
    }
    if (!canRunBind(refreshId)) {
      try {
        stop();
      } catch {
        // Disposal owns no live binding, so cleanup is best-effort here.
      }
      return false;
    }
    applyStop(stop);
    return true;
  };

  const scheduleDeferredBind = (refreshId: number) => {
    cancelDeferredBind();
    if (!canRunBind(refreshId)) {
      return;
    }
    cancelDeferredBind = deferTargetResolution(() => {
      cancelDeferredBind = () => {};
      if (!canRunBind(refreshId)) {
        return;
      }
      stopCurrent();
      if (!canRunBind(refreshId)) {
        return;
      }
      bindCurrent(refreshId);
    });
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    const refreshId = ++refreshGeneration;
    cancelDeferredBind();
    cancelDeferredBind = () => {};
    if (!ownsRefresh(refreshId)) {
      return;
    }
    stopCurrent();
    if (!ownsRefresh(refreshId)) {
      return;
    }

    if (!canBind()) {
      return;
    }

    if (!bindCurrent(refreshId) && canRunBind(refreshId)) {
      scheduleDeferredBind(refreshId);
    }
  };

  createEffect(() => {
    refresh();

    onCleanup(() => {
      cancelDeferredBind();
      cancelDeferredBind = () => {};
      stopCurrent();
    });
  });

  tryOnDestroy(() => {
    disposed = true;
    controlGeneration += 1;
    active(false);
    cancelDeferredBind();
    cancelDeferredBind = () => {};
    stopCurrent();
  });

  return {
    start() {
      if (disposed) {
        return;
      }
      const controlId = ++controlGeneration;
      if (!active()) {
        active(true);
      }
      if (!ownsControl(controlId)) {
        return;
      }
      if (!bound) {
        refresh();
      }
    },
    stop() {
      if (disposed || !active()) {
        return;
      }
      const controlId = ++controlGeneration;
      active(false);
      if (!ownsControl(controlId)) {
        return;
      }
      cancelDeferredBind();
      cancelDeferredBind = () => {};
      if (!ownsControl(controlId)) {
        return;
      }
      stopCurrent();
    },
    refresh,
    active
  };
}
