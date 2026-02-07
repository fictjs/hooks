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

function isNodeInside(elements: Element[], node: Node): boolean {
  return elements.some((element) => element.contains(node));
}

/**
 * Trigger handler when pointer interaction happens outside target elements.
 *
 * @fictReturn { active: 'signal' }
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

    if (isNodeInside(targetElements, node) || isNodeInside(ignoreElements, node)) {
      return false;
    }

    return true;
  };

  const onPointerDown = (event: Event) => {
    pointerDownOutside = isOutside(event);
  };

  const onClick = (event: Event) => {
    if (pointerDownOutside && isOutside(event)) {
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

  return {
    start() {
      downControls.start();
      clickControls.start();
    },
    stop() {
      downControls.stop();
      clickControls.stop();
    },
    active() {
      return downControls.active() && clickControls.active();
    },
    trigger(event) {
      handler(event ?? new Event('click'));
    }
  };
}
