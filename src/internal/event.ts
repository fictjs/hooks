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
  const registrations: Array<{ target: EventTarget; name: string }> = [];

  try {
    for (const target of resolvedTargets) {
      for (const name of names) {
        registrations.push({ target, name });
        target.addEventListener(name, listener, options);
      }
    }
  } catch (error) {
    for (const registration of registrations.reverse()) {
      try {
        registration.target.removeEventListener(registration.name, listener, options);
      } catch {
        // Preserve the setup failure while still attempting every rollback.
      }
    }
    throw error;
  }

  let active = true;

  return {
    stop() {
      if (!active) {
        return;
      }

      active = false;
      let cleanupFailed = false;
      let cleanupError: unknown;
      for (const registration of registrations) {
        try {
          registration.target.removeEventListener(registration.name, listener, options);
        } catch (error) {
          if (!cleanupFailed) {
            cleanupFailed = true;
            cleanupError = error;
          }
        }
      }
      if (cleanupFailed) {
        throw cleanupError;
      }
    }
  };
}
