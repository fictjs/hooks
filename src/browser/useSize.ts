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
  let disposed = false;

  const applyRect = (nextTarget: Element) => {
    const rect = readRect(nextTarget);
    width(rect.width);
    height(rect.height);
    top(rect.top);
    left(rect.left);
    x(rect.x);
    y(rect.y);
  };

  const applyPosition = (nextTarget: Element) => {
    const rect = readRect(nextTarget);
    top(rect.top);
    left(rect.left);
    x(rect.x);
    y(rect.y);
  };

  const update = () => {
    const nextTarget = resolveMaybeTarget(target);
    if (!nextTarget) {
      return;
    }
    applyRect(nextTarget);
  };

  const resizeListener = useEventListener(windowRef, 'resize', update, {
    passive: true,
    immediate: false
  });
  const scrollListener = useEventListener(
    windowRef,
    'scroll',
    () => {
      const nextTarget = resolveMaybeTarget(target);
      if (nextTarget) {
        applyPosition(nextTarget);
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

  const startObserving = (nextTarget: Element) => {
    applyRect(nextTarget);
    if (windowRef) {
      resizeListener.start();
      scrollListener.start();
    }

    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      return;
    }

    isSupported(true);
    const generation = ++observerGeneration;
    const nextObserver = new Observer((entries: ResizeObserverEntry[]) => {
      if (disposed || !active() || generation !== observerGeneration) {
        return;
      }
      const entry = entries[0];
      if (entry) {
        const boxSize = readBoxSize(entry, box, nextTarget, windowRef);
        if (boxSize) {
          width(boxSize.width);
          height(boxSize.height);
          applyPosition(nextTarget);
          return;
        }
        applyRect(nextTarget);
        return;
      }
      applyRect(nextTarget);
    });

    try {
      nextObserver.observe(nextTarget, { box });
    } catch (error) {
      if (generation === observerGeneration) {
        observerGeneration += 1;
      }
      try {
        nextObserver.disconnect();
      } catch {
        // Preserve the original observe error.
      }
      throw error;
    }
    observer = nextObserver;
  };

  const scheduleDeferredTarget = () => {
    cancelDeferredTarget();
    cancelDeferredTarget = deferTargetResolution(() => {
      cancelDeferredTarget = () => {};
      if (!active()) {
        return;
      }

      const nextTarget = target ? resolveMaybeTarget(target) : undefined;
      if (!nextTarget) {
        resizeListener.stop();
        scrollListener.stop();
        return;
      }

      stopObserver();
      startObserving(nextTarget);
    });
  };

  const refresh = () => {
    cancelDeferredTarget();
    cancelDeferredTarget = () => {};
    stopObserver();
    resizeListener.stop();
    scrollListener.stop();

    if (!active()) {
      return;
    }

    const nextTarget = target ? resolveMaybeTarget(target) : undefined;
    if (!nextTarget) {
      if (target) {
        scheduleDeferredTarget();
      }
      return;
    }

    startObserving(nextTarget);
  };

  createEffect(() => {
    refresh();

    onCleanup(() => {
      cancelDeferredTarget();
      cancelDeferredTarget = () => {};
      resizeListener.stop();
      scrollListener.stop();
      stopObserver();
    });
  });

  tryOnDestroy(() => {
    disposed = true;
    observerGeneration += 1;
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
      if (!active()) {
        active(true);
      } else {
        refresh();
      }
    },
    stop() {
      active(false);
      cancelDeferredTarget();
      cancelDeferredTarget = () => {};
      resizeListener.stop();
      scrollListener.stop();
      stopObserver();
    },
    refresh
  };
}
