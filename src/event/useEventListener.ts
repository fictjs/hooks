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

  const canBind = () => !disposed && active();

  const bind = (): (() => void) | undefined => {
    const targets = resolveTargetList(target);
    if (!canBind()) {
      return undefined;
    }
    const eventNames = toArray(toValue(event as MaybeAccessor<EventName>));
    if (!canBind()) {
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
    if (!canBind() || generation !== bindingGeneration) {
      return undefined;
    }
    const controller = addEventListeners(targets, eventNames, listener, listenerOptions);
    const stop = () => {
      if (generation === bindingGeneration) {
        bindingGeneration += 1;
      }
      controller.stop();
    };
    if (!canBind() || generation !== bindingGeneration) {
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

  const bindCurrent = (): boolean => {
    const stop = bind();
    if (!stop) {
      return false;
    }
    if (!canBind()) {
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

  const scheduleDeferredBind = () => {
    cancelDeferredBind();
    if (!canBind()) {
      return;
    }
    cancelDeferredBind = deferTargetResolution(() => {
      cancelDeferredBind = () => {};
      if (!canBind()) {
        return;
      }
      stopCurrent();
      if (!canBind()) {
        return;
      }
      bindCurrent();
    });
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    cancelDeferredBind();
    cancelDeferredBind = () => {};
    if (disposed) {
      return;
    }
    stopCurrent();

    if (!canBind()) {
      return;
    }

    if (!bindCurrent() && canBind()) {
      scheduleDeferredBind();
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
      if (!active()) {
        active(true);
      }
      if (disposed) {
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
      active(false);
      if (disposed) {
        return;
      }
      cancelDeferredBind();
      cancelDeferredBind = () => {};
      if (disposed) {
        return;
      }
      stopCurrent();
    },
    refresh,
    active
  };
}
