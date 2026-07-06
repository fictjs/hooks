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

function getEventPath(event: Event): EventTarget[] {
  return typeof event.composedPath === 'function' ? event.composedPath() : [];
}

function isKeyboardClick(event: Event): boolean {
  return event instanceof MouseEvent && event.detail === 0;
}

function isNodeInside(elements: Element[], node: Node, event: Event): boolean {
  const path = getEventPath(event);
  return elements.some(
    (element) =>
      element.contains(node) ||
      path.includes(element) ||
      path.some((entry) => entry instanceof Node && element.contains(entry))
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
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const ignoreTargets = options.ignore ? toArray(options.ignore) : [];

  let pointerDownOutside = false;

  const isOutside = (event: Event) => {
    const node = event.target as Node | null;
    if (!node || !documentRef) {
      return false;
    }

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

    if (isNodeInside(targetElements, node, event) || isNodeInside(ignoreElements, node, event)) {
      return false;
    }

    return true;
  };

  const onPointerDown = (event: Event) => {
    pointerDownOutside = isOutside(event);
  };

  const onClick = (event: Event) => {
    if ((pointerDownOutside || isKeyboardClick(event)) && isOutside(event)) {
      handler(event);
    }
    pointerDownOutside = false;
  };

  const downControls = useEventListener(windowRef, 'pointerdown', onPointerDown, {
    capture: options.capture ?? true,
    passive: true
  });
  const clickControls = useEventListener(windowRef, 'click', onClick, {
    capture: options.capture ?? true,
    passive: true
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
      handler(event ?? new Event('click'));
    }
  };
}
