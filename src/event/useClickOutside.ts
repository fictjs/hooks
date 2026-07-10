import { createMemo } from '@fictjs/runtime';
import { useEventListener, type UseEventListenerControls } from './useEventListener';
import {
  resolveIgnoreElement,
  resolveMaybeTarget,
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

type OperationGuard = () => boolean;

function getEventPath(event: Event, isCurrent: OperationGuard): EventTarget[] {
  const composedPath = event.composedPath;
  if (!isCurrent() || typeof composedPath !== 'function') {
    return [];
  }
  const path = composedPath.call(event);
  return isCurrent() ? path : [];
}

function isKeyboardClick(
  event: Event,
  MouseEventCtor: typeof MouseEvent | undefined,
  isCurrent: OperationGuard
): boolean {
  const isMouseEvent = !!MouseEventCtor && event instanceof MouseEventCtor;
  if (!isCurrent() || !isMouseEvent) {
    return false;
  }
  const detail = event.detail;
  return isCurrent() && detail === 0;
}

function isNodeInside(
  elements: Element[],
  node: Node,
  event: Event,
  isCurrent: OperationGuard
): boolean {
  const path = getEventPath(event, isCurrent);
  if (!isCurrent()) {
    return false;
  }

  for (const element of elements) {
    const containsNode = element.contains(node);
    if (!isCurrent()) {
      return false;
    }
    if (containsNode) {
      return true;
    }

    const pathIncludesElement = path.includes(element);
    if (!isCurrent()) {
      return false;
    }
    if (pathIncludesElement) {
      return true;
    }

    for (const entry of path) {
      let containsEntry = false;
      try {
        containsEntry = element.contains(entry as Node);
      } catch {
        // Cross-realm and non-Node path entries are not descendants.
      }
      if (!isCurrent()) {
        return false;
      }
      if (containsEntry) {
        return true;
      }
    }
  }

  return false;
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
  let operation = 0;
  let isActiveOperation: (currentOperation: number) => boolean = () => false;

  const isOutside = (event: Event, isCurrent: OperationGuard) => {
    const eventTarget = event.target;
    if (!isCurrent() || !eventTarget || !documentRef) {
      return false;
    }

    const targetElements: Element[] = [];
    for (const item of toArray(target)) {
      const resolved = resolveMaybeTarget(item);
      if (!isCurrent()) {
        return false;
      }
      if (resolved) {
        targetElements.push(resolved);
      }
    }
    if (targetElements.length === 0) {
      return false;
    }
    const targetIsNode = isNodeValue(targetElements[0]!, eventTarget);
    if (!isCurrent() || !targetIsNode) {
      return false;
    }
    const node = eventTarget;

    const ignoreElements: Element[] = [];
    for (const item of ignoreTargets) {
      const resolved = resolveIgnoreElement(item, documentRef);
      if (!isCurrent()) {
        return false;
      }
      if (!resolved) {
        continue;
      }
      ignoreElements.push(...(Array.isArray(resolved) ? resolved : [resolved]));
    }

    const insideTarget = isNodeInside(targetElements, node, event, isCurrent);
    if (!isCurrent() || insideTarget) {
      return false;
    }
    const insideIgnore = isNodeInside(ignoreElements, node, event, isCurrent);
    if (!isCurrent() || insideIgnore) {
      return false;
    }

    return true;
  };

  const onPointerDown = (event: Event) => {
    const currentOperation = operation;
    const isCurrent = () => isActiveOperation(currentOperation);
    try {
      const outside = isOutside(event, isCurrent);
      pointerDownOutside = isCurrent() && outside;
    } catch (error) {
      pointerDownOutside = false;
      throw error;
    }
  };

  const onClick = (event: Event) => {
    const currentOperation = operation;
    const isCurrent = () => isActiveOperation(currentOperation);
    try {
      if (!isCurrent()) {
        return;
      }
      const keyboardClick = pointerDownOutside
        ? false
        : isKeyboardClick(event, MouseEventCtor, isCurrent);
      if (!isCurrent() || (!pointerDownOutside && !keyboardClick)) {
        return;
      }
      const outside = isOutside(event, isCurrent);
      if (isCurrent() && outside) {
        handler(event);
      }
    } finally {
      pointerDownOutside = false;
    }
  };

  const downControls: UseEventListenerControls = useEventListener(
    windowRef,
    'pointerdown',
    onPointerDown,
    {
      capture: options.capture ?? true,
      passive: true
    }
  );
  const clickControls: UseEventListenerControls = useEventListener(windowRef, 'click', onClick, {
    capture: options.capture ?? true
  });
  isActiveOperation = (currentOperation) =>
    currentOperation === operation && downControls.active() && clickControls.active();
  const active = createMemo(() => downControls.active() && clickControls.active());

  const stopAll = () => {
    operation += 1;
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
      const startOperation = ++operation;
      try {
        downControls.start();
        if (operation !== startOperation) {
          return;
        }
        clickControls.start();
      } catch (error) {
        if (operation === startOperation) {
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
