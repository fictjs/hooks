import { createMemo } from '@fictjs/runtime';
import { useEventListener } from './useEventListener';
import {
  resolveIgnoreElement,
  resolveTargetList,
  type IgnoreTarget,
  type MaybeElement
} from '../internal/target';
import { defaultDocument, defaultWindow } from '../internal/env';
import { toArray } from '../internal/value';

export interface UseClickOutsideOptions {
  window?: Window | null;
  document?: Document | null;
  ignore?: IgnoreTarget | IgnoreTarget[];
  capture?: boolean;
}

export interface UseClickOutsideControls {
  start: () => void;
  stop: () => void;
  active: () => boolean;
  trigger: (event?: Event) => void;
}

type WindowWithDomConstructors = Window & {
  Event: typeof Event;
  MouseEvent: typeof MouseEvent;
};

function getEventPath(event: Event): EventTarget[] {
  return typeof event.composedPath === 'function' ? event.composedPath() : [];
}

function isKeyboardClick(event: Event, MouseEventCtor?: typeof MouseEvent): boolean {
  return !!MouseEventCtor && event instanceof MouseEventCtor && event.detail === 0;
}

function isNodeInside(elements: Element[], node: Node, event: Event): boolean {
  const path = getEventPath(event);
  return elements.some(
    (element) =>
      element.contains(node) ||
      path.includes(element) ||
      path.some((entry) => {
        try {
          return element.contains(entry as Node);
        } catch {
          return false;
        }
      })
  );
}

function isNodeValue(probe: Element, target: EventTarget): target is Node {
  try {
    probe.contains(target as Node);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger handler when pointer interaction happens outside target elements.
 *
 * @fictReturn { active: 'memo' }
 */
export function useClickOutside(
  target: MaybeElement | MaybeElement[],
  handler: (event: Event) => void,
  options: UseClickOutsideOptions = {}
): UseClickOutsideControls {
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const windowRef =
    options.window === undefined
      ? options.document === undefined
        ? defaultWindow
        : documentRef?.defaultView
      : options.window;
  const ignoreTargets = options.ignore ? toArray(options.ignore) : [];
  const realmWindow = (windowRef ?? documentRef?.defaultView) as WindowWithDomConstructors | null;
  const MouseEventCtor = realmWindow?.MouseEvent;

  let pointerDownOutside = false;

  const isOutside = (event: Event) => {
    const eventTarget = event.target;
    if (!eventTarget || !documentRef) {
      return false;
    }

    const targetElements = resolveTargetList(target);
    if (targetElements.length === 0) {
      return false;
    }
    if (!isNodeValue(targetElements[0]!, eventTarget)) {
      return false;
    }
    const node = eventTarget;

    const ignoreElements = ignoreTargets.flatMap((item) => {
      const resolved = resolveIgnoreElement(item, documentRef);
      if (!resolved) {
        return [];
      }
      return Array.isArray(resolved) ? resolved : [resolved];
    });

    if (isNodeInside(targetElements, node, event) || isNodeInside(ignoreElements, node, event)) {
      return false;
    }

    return true;
  };

  const onPointerDown = (event: Event) => {
    try {
      pointerDownOutside = isOutside(event);
    } catch (error) {
      pointerDownOutside = false;
      throw error;
    }
  };

  const onClick = (event: Event) => {
    try {
      if ((pointerDownOutside || isKeyboardClick(event, MouseEventCtor)) && isOutside(event)) {
        handler(event);
      }
    } finally {
      pointerDownOutside = false;
    }
  };

  const downControls = useEventListener(windowRef, 'pointerdown', onPointerDown, {
    capture: options.capture ?? true,
    passive: true
  });
  const clickControls = useEventListener(windowRef, 'click', onClick, {
    capture: options.capture ?? true
  });
  const active = createMemo(() => downControls.active() && clickControls.active());

  const stopAll = () => {
    pointerDownOutside = false;
    let cleanupFailed = false;
    let cleanupError: unknown;
    for (const controls of [downControls, clickControls]) {
      try {
        controls.stop();
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
  };

  return {
    start() {
      try {
        downControls.start();
        clickControls.start();
      } catch (error) {
        pointerDownOutside = false;
        try {
          clickControls.stop();
        } catch {
          // Preserve the setup failure after best-effort rollback.
        }
        try {
          downControls.stop();
        } catch {
          // Preserve the setup failure after best-effort rollback.
        }
        throw error;
      }
    },
    stop: stopAll,
    active,
    trigger(event) {
      const EventCtor = realmWindow?.Event ?? globalThis.Event;
      handler(event ?? new EventCtor('click'));
    }
  };
}
