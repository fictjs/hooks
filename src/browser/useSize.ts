import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
import { deferTargetResolution, resolveMaybeTarget, type MaybeElement } from '../internal/target';

export interface UseSizeOptions {
  window?: Window | null;
  box?: ResizeObserverBoxOptions;
  initialWidth?: number;
  initialHeight?: number;
  initialTop?: number;
  initialLeft?: number;
  initialX?: number;
  initialY?: number;
  immediate?: boolean;
}

export interface UseSizeReturn {
  width: () => number;
  height: () => number;
  top: () => number;
  left: () => number;
  x: () => number;
  y: () => number;
  isSupported: () => boolean;
  active: () => boolean;
  update: () => void;
  start: () => void;
  stop: () => void;
  refresh: () => void;
}

function readRect(target: Element) {
  const rect = target.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    x: rect.x ?? rect.left,
    y: rect.y ?? rect.top
  };
}

function usesVerticalWritingMode(target: Element, windowRef: Window | null | undefined): boolean {
  const view = target.ownerDocument?.defaultView ?? windowRef;
  const writingMode = view?.getComputedStyle?.(target).writingMode ?? '';
  return /^(?:vertical|sideways|tb)/.test(writingMode);
}

function readBoxSize(
  entry: ResizeObserverEntry,
  box: ResizeObserverBoxOptions,
  target: Element,
  windowRef: Window | null | undefined
) {
  const sizeSource =
    box === 'border-box'
      ? entry.borderBoxSize
      : box === 'device-pixel-content-box'
        ? entry.devicePixelContentBoxSize
        : entry.contentBoxSize;
  const size = Array.isArray(sizeSource) ? sizeSource[0] : sizeSource;

  if (size) {
    if (usesVerticalWritingMode(target, windowRef)) {
      return {
        width: size.blockSize,
        height: size.inlineSize
      };
    }
    return {
      width: size.inlineSize,
      height: size.blockSize
    };
  }

  if (box === 'content-box') {
    return {
      width: entry.contentRect.width,
      height: entry.contentRect.height
    };
  }

  return null;
}

/**
 * Track element size/position reactively.
 *
 * @fictReturn { width: 'signal', height: 'signal', top: 'signal', left: 'signal', x: 'signal', y: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useSize(target: MaybeElement | null, options: UseSizeOptions = {}): UseSizeReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const box = options.box ?? 'border-box';
  const observerCtor = (windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)
    ?.ResizeObserver;

  const width = createSignal(options.initialWidth ?? 0);
  const height = createSignal(options.initialHeight ?? 0);
  const top = createSignal(options.initialTop ?? 0);
  const left = createSignal(options.initialLeft ?? 0);
  const x = createSignal(options.initialX ?? options.initialLeft ?? 0);
  const y = createSignal(options.initialY ?? options.initialTop ?? 0);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(options.immediate ?? true);

  let observer: ResizeObserver | null = null;
  let cancelDeferredTarget = () => {};
  let observerGeneration = 0;
  let operationGeneration = 0;
  let disposed = false;
  const beginOperation = () => ++operationGeneration;
  const ownsOperation = (operation: number) => !disposed && operation === operationGeneration;
  const canRunSetup = (operation: number) => ownsOperation(operation) && active();

  const applyRect = (nextTarget: Element, canCommit: () => boolean) => {
    if (!canCommit()) {
      return;
    }
    const rect = readRect(nextTarget);
    if (!canCommit()) {
      return;
    }
    width(rect.width);
    if (!canCommit()) {
      return;
    }
    height(rect.height);
    if (!canCommit()) {
      return;
    }
    top(rect.top);
    if (!canCommit()) {
      return;
    }
    left(rect.left);
    if (!canCommit()) {
      return;
    }
    x(rect.x);
    if (!canCommit()) {
      return;
    }
    y(rect.y);
  };

  const applyPosition = (nextTarget: Element, canCommit: () => boolean) => {
    if (!canCommit()) {
      return;
    }
    const rect = readRect(nextTarget);
    if (!canCommit()) {
      return;
    }
    top(rect.top);
    if (!canCommit()) {
      return;
    }
    left(rect.left);
    if (!canCommit()) {
      return;
    }
    x(rect.x);
    if (!canCommit()) {
      return;
    }
    y(rect.y);
  };

  const update = () => {
    if (disposed) {
      return;
    }
    const operation = beginOperation();
    const canCommit = () => ownsOperation(operation);
    const nextTarget = resolveMaybeTarget(target);
    if (!canCommit() || !nextTarget) {
      return;
    }
    applyRect(nextTarget, canCommit);
  };

  const resizeListener = useEventListener(windowRef, 'resize', update, {
    passive: true,
    immediate: false
  });
  const scrollListener = useEventListener(
    windowRef,
    'scroll',
    () => {
      if (disposed || !active()) {
        return;
      }
      const operation = beginOperation();
      const canCommit = () => ownsOperation(operation) && active();
      const nextTarget = resolveMaybeTarget(target);
      if (!canCommit()) {
        return;
      }
      if (nextTarget) {
        applyPosition(nextTarget, canCommit);
      }
    },
    {
      capture: true,
      passive: true,
      immediate: false
    }
  );

  const stopObserver = () => {
    if (!observer) {
      return;
    }
    const currentObserver = observer;
    observer = null;
    observerGeneration += 1;
    currentObserver.disconnect();
  };

  const startObserving = (nextTarget: Element, operation: number) => {
    if (!canRunSetup(operation)) {
      return;
    }
    const canCommit = () => canRunSetup(operation);
    applyRect(nextTarget, canCommit);
    if (!canRunSetup(operation)) {
      return;
    }
    if (windowRef) {
      resizeListener.start();
      if (!canRunSetup(operation)) {
        return;
      }
      scrollListener.start();
      if (!canRunSetup(operation)) {
        return;
      }
    }

    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      return;
    }

    isSupported(true);
    if (!canRunSetup(operation)) {
      return;
    }
    const generation = ++observerGeneration;
    const nextObserver = new Observer((entries: ResizeObserverEntry[]) => {
      if (disposed || !active() || generation !== observerGeneration) {
        return;
      }
      const callbackOperation = beginOperation();
      const canCommitObserver = () =>
        ownsOperation(callbackOperation) && active() && generation === observerGeneration;
      const entry = entries[0];
      if (!canCommitObserver()) {
        return;
      }
      if (entry) {
        const boxSize = readBoxSize(entry, box, nextTarget, windowRef);
        if (!canCommitObserver()) {
          return;
        }
        if (boxSize) {
          width(boxSize.width);
          if (!canCommitObserver()) {
            return;
          }
          height(boxSize.height);
          if (!canCommitObserver()) {
            return;
          }
          applyPosition(nextTarget, canCommitObserver);
          return;
        }
        applyRect(nextTarget, canCommitObserver);
        return;
      }
      applyRect(nextTarget, canCommitObserver);
    });

    const disconnectNextObserver = () => {
      try {
        nextObserver.disconnect();
      } catch {
        // Setup/disposal failures must not be replaced by disconnect failures.
      }
    };

    // Observer identity remains generation-owned so a synchronous refresh can install a
    // replacement without the superseded setup disconnecting that newer observer.
    if (disposed || generation !== observerGeneration) {
      disconnectNextObserver();
      return;
    }

    observer = nextObserver;
    try {
      nextObserver.observe(nextTarget, { box });
    } catch (error) {
      if (observer === nextObserver) {
        observer = null;
        if (generation === observerGeneration) {
          observerGeneration += 1;
        }
        disconnectNextObserver();
      }
      throw error;
    }

    if (observer !== nextObserver) {
      return;
    }
    if (disposed || !active() || generation !== observerGeneration) {
      observer = null;
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      disconnectNextObserver();
    }
  };

  const scheduleDeferredTarget = (operation: number) => {
    if (!canRunSetup(operation)) {
      return;
    }
    cancelDeferredTarget();
    if (!canRunSetup(operation)) {
      return;
    }
    const cancel = deferTargetResolution(() => {
      cancelDeferredTarget = () => {};
      if (disposed || !active()) {
        return;
      }
      const deferredOperation = beginOperation();
      const canContinue = () => canRunSetup(deferredOperation);

      const nextTarget = target ? resolveMaybeTarget(target) : undefined;
      if (!canContinue()) {
        return;
      }
      if (!nextTarget) {
        resizeListener.stop();
        if (!canContinue()) {
          return;
        }
        scrollListener.stop();
        return;
      }

      stopObserver();
      if (!canContinue()) {
        return;
      }
      startObserving(nextTarget, deferredOperation);
    });
    if (!canRunSetup(operation)) {
      cancel();
      return;
    }
    cancelDeferredTarget = cancel;
  };

  const refreshOperation = (operation: number) => {
    if (!ownsOperation(operation)) {
      return;
    }
    cancelDeferredTarget();
    if (!ownsOperation(operation)) {
      return;
    }
    cancelDeferredTarget = () => {};
    stopObserver();
    if (!ownsOperation(operation)) {
      return;
    }
    resizeListener.stop();
    if (!ownsOperation(operation)) {
      return;
    }
    scrollListener.stop();

    if (!ownsOperation(operation)) {
      return;
    }

    if (!active()) {
      return;
    }

    const nextTarget = target ? resolveMaybeTarget(target) : undefined;
    if (!ownsOperation(operation)) {
      return;
    }
    if (!nextTarget) {
      if (target) {
        scheduleDeferredTarget(operation);
      }
      return;
    }

    startObserving(nextTarget, operation);
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    refreshOperation(beginOperation());
  };

  createEffect(() => {
    refresh();

    onCleanup(() => {
      const cleanupOperation = beginOperation();
      const canContinue = () => disposed || cleanupOperation === operationGeneration;
      cancelDeferredTarget();
      cancelDeferredTarget = () => {};
      if (!canContinue()) {
        return;
      }
      resizeListener.stop();
      if (!canContinue()) {
        return;
      }
      scrollListener.stop();
      if (!canContinue()) {
        return;
      }
      stopObserver();
    });
  });

  tryOnDestroy(() => {
    disposed = true;
    operationGeneration += 1;
    observerGeneration += 1;
    active(false);
  });

  return {
    width,
    height,
    top,
    left,
    x,
    y,
    isSupported,
    active,
    update,
    start() {
      if (disposed) {
        return;
      }
      const operation = beginOperation();
      if (!active()) {
        active(true);
      } else {
        refreshOperation(operation);
      }
    },
    stop() {
      if (disposed) {
        return;
      }
      const operation = beginOperation();
      active(false);
      if (!ownsOperation(operation)) {
        return;
      }
      cancelDeferredTarget();
      if (!ownsOperation(operation)) {
        return;
      }
      cancelDeferredTarget = () => {};
      resizeListener.stop();
      if (!ownsOperation(operation)) {
        return;
      }
      scrollListener.stop();
      if (!ownsOperation(operation)) {
        return;
      }
      stopObserver();
    },
    refresh
  };
}
