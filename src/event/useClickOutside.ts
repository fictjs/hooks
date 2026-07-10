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
  Node: typeof Node;
};

function getEventPath(event: Event): EventTarget[] {
  return typeof event.composedPath === 'function' ? event.composedPath() : [];
}

function isKeyboardClick(event: Event, MouseEventCtor?: typeof MouseEvent): boolean {
  return !!MouseEventCtor && event instanceof MouseEventCtor && event.detail === 0;
}

function isNodeInside(
  elements: Element[],
  node: Node,
  event: Event,
  NodeCtor: typeof Node
): boolean {
  const path = getEventPath(event);
  return elements.some(
    (element) =>
      element.contains(node) ||
      path.includes(element) ||
      path.some((entry) => entry instanceof NodeCtor && element.contains(entry))
  );
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
  const NodeCtor = realmWindow?.Node;
  const MouseEventCtor = realmWindow?.MouseEvent;

  let pointerDownOutside = false;

  const isOutside = (event: Event) => {
    const eventTarget = event.target;
    if (!eventTarget || !documentRef || !NodeCtor || !(eventTarget instanceof NodeCtor)) {
      return false;
    }
    const node = eventTarget as Node;

    const targetElements = resolveTargetList(target);
    if (targetElements.length === 0) {
      return false;
    }

    const ignoreElements = ignoreTargets.flatMap((item) => {
      const resolved = resolveIgnoreElement(item, documentRef);
      if (!resolved) {
        return [];
      }
      return Array.isArray(resolved) ? resolved : [resolved];
    });

    if (
      isNodeInside(targetElements, node, event, NodeCtor) ||
      isNodeInside(ignoreElements, node, event, NodeCtor)
    ) {
      return false;
    }

    return true;
  };

  const onPointerDown = (event: Event) => {
    pointerDownOutside = isOutside(event);
  };

  const onClick = (event: Event) => {
    if ((pointerDownOutside || isKeyboardClick(event, MouseEventCtor)) && isOutside(event)) {
      handler(event);
    }
    pointerDownOutside = false;
  };

  const downControls = useEventListener(windowRef, 'pointerdown', onPointerDown, {
    capture: options.capture ?? true,
    passive: true
  });
  const clickControls = useEventListener(windowRef, 'click', onClick, {
    capture: options.capture ?? true
  });
  const active = createMemo(() => downControls.active() && clickControls.active());

  return {
    start() {
      downControls.start();
      clickControls.start();
    },
    stop() {
      downControls.stop();
      clickControls.stop();
    },
    active,
    trigger(event) {
      const EventCtor = realmWindow?.Event ?? globalThis.Event;
      handler(event ?? new EventCtor('click'));
    }
  };
}
