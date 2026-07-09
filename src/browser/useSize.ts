import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultWindow } from '../internal/env';
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

function readBoxSize(entry: ResizeObserverEntry, box: ResizeObserverBoxOptions) {
  const sizeSource =
    box === 'border-box'
      ? entry.borderBoxSize
      : box === 'device-pixel-content-box'
        ? entry.devicePixelContentBoxSize
        : entry.contentBoxSize;
  const size = Array.isArray(sizeSource) ? sizeSource[0] : sizeSource;

  if (size) {
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

  const stopObserver = () => {
    if (!observer) {
      return;
    }
    observer.disconnect();
    observer = null;
  };

  const startObserving = (nextTarget: Element) => {
    applyRect(nextTarget);
    if (windowRef) {
      resizeListener.start();
    }

    const Observer = observerCtor;
    if (!Observer) {
      isSupported(false);
      return;
    }

    isSupported(true);
    observer = new Observer((entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (entry) {
        const boxSize = readBoxSize(entry, box);
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

    observer.observe(nextTarget, { box });
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
        return;
      }

      stopObserver();
      startObserving(nextTarget);
    });
  };

  createEffect(() => {
    cancelDeferredTarget();
    cancelDeferredTarget = () => {};
    stopObserver();

    const nextTarget = target ? resolveMaybeTarget(target) : undefined;
    if (!active() || !nextTarget) {
      resizeListener.stop();
      if (active() && target) {
        scheduleDeferredTarget();
      }
      onCleanup(() => {
        cancelDeferredTarget();
        cancelDeferredTarget = () => {};
        resizeListener.stop();
        stopObserver();
      });
      return;
    }

    startObserving(nextTarget);

    onCleanup(() => {
      cancelDeferredTarget();
      cancelDeferredTarget = () => {};
      stopObserver();
    });
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
      active(true);
    },
    stop() {
      active(false);
      cancelDeferredTarget();
      cancelDeferredTarget = () => {};
      resizeListener.stop();
      stopObserver();
    }
  };
}
