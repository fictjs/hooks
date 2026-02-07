import { resolveTargetList, type MaybeTarget } from './target';
import { toArray } from './value';

export interface EventListenerController {
  stop: () => void;
}

export type EventName = string | string[];

export interface UseEventListenerOptions extends AddEventListenerOptions {
  immediate?: boolean;
}

export function addEventListeners(
  targets: MaybeTarget<EventTarget> | Array<MaybeTarget<EventTarget>>,
  events: EventName,
  listener: EventListener,
  options?: AddEventListenerOptions
): EventListenerController {
  const resolvedTargets = resolveTargetList(targets);
  const names = toArray(events);

  for (const target of resolvedTargets) {
    for (const name of names) {
      target.addEventListener(name, listener, options);
    }
  }

  let active = true;

  return {
    stop() {
      if (!active) {
        return;
      }

      active = false;
      for (const target of resolvedTargets) {
        for (const name of names) {
          target.removeEventListener(name, listener, options);
        }
      }
    }
  };
}
