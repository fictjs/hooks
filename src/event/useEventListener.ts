import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { addEventListeners, type EventName, type UseEventListenerOptions } from '../internal/event';
import { resolveTargetList, type MaybeTarget } from '../internal/target';
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
  handler: ((event: E) => void) | MaybeAccessor<(event: E) => void>,
  options: UseEventListenerOptions = {}
): UseEventListenerControls {
  const active = createSignal(options.immediate ?? true);
  let stopCurrent = () => {};

  const bind = (): (() => void) | undefined => {
    const targets = resolveTargetList(target);
    const eventNames = toArray(toValue(event as MaybeAccessor<EventName>));

    if (targets.length === 0 || eventNames.length === 0) {
      return undefined;
    }

    const listener = (eventObject: Event) => {
      const fn = toValue(handler as MaybeAccessor<(event: E) => void>);
      fn(eventObject as E);
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: options.capture,
      once: options.once,
      passive: options.passive
    };
    const controller = addEventListeners(targets, eventNames, listener, listenerOptions);
    return () => controller.stop();
  };

  createEffect(() => {
    stopCurrent();
    stopCurrent = () => {};

    if (!active()) {
      return;
    }

    const stop = bind();
    if (!stop) {
      return;
    }
    stopCurrent = () => {
      stop();
      stopCurrent = () => {};
    };

    onCleanup(() => {
      stopCurrent();
    });
  });

  return {
    start() {
      if (!active()) {
        active(true);
        const stop = bind();
        if (stop) {
          stopCurrent = () => {
            stop();
            stopCurrent = () => {};
          };
        }
      }
    },
    stop() {
      if (!active()) {
        return;
      }
      active(false);
      stopCurrent();
    },
    active
  };
}
