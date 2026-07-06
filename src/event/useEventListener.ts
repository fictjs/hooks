import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { addEventListeners, type EventName, type UseEventListenerOptions } from '../internal/event';
import { deferTargetResolution, resolveTargetList, type MaybeTarget } from '../internal/target';
import { toArray, toValue, type MaybeAccessor } from '../internal/value';

export interface UseEventListenerControls {
  start: () => void;
  stop: () => void;
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

  const bind = (): (() => void) | undefined => {
    const targets = resolveTargetList(target);
    const eventNames = toArray(toValue(event as MaybeAccessor<EventName>));

    if (targets.length === 0 || eventNames.length === 0) {
      return undefined;
    }

    const listener = (eventObject: Event) => {
      handler(eventObject as E);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: options.capture,
      once: options.once,
      passive: options.passive
    };
    const controller = addEventListeners(targets, eventNames, listener, listenerOptions);
    return () => controller.stop();
  };

  const applyStop = (stop: () => void) => {
    stopCurrent = () => {
      stop();
      stopCurrent = () => {};
    };
  };

  const bindCurrent = (): boolean => {
    const stop = bind();
    if (!stop) {
      return false;
    }
    applyStop(stop);
    return true;
  };

  const scheduleDeferredBind = () => {
    cancelDeferredBind();
    cancelDeferredBind = deferTargetResolution(() => {
      cancelDeferredBind = () => {};
      if (!active()) {
        return;
      }
      stopCurrent();
      bindCurrent();
    });
  };

  createEffect(() => {
    cancelDeferredBind();
    cancelDeferredBind = () => {};
    stopCurrent();
    stopCurrent = () => {};

    if (!active()) {
      return;
    }

    if (!bindCurrent()) {
      scheduleDeferredBind();
    }

    onCleanup(() => {
      cancelDeferredBind();
      cancelDeferredBind = () => {};
      stopCurrent();
    });
  });

  return {
    start() {
      if (!active()) {
        active(true);
        stopCurrent();
        stopCurrent = () => {};
        if (!bindCurrent()) {
          scheduleDeferredBind();
        }
      }
    },
    stop() {
      if (!active()) {
        return;
      }
      active(false);
      cancelDeferredBind();
      cancelDeferredBind = () => {};
      stopCurrent();
    },
    active
  };
}
