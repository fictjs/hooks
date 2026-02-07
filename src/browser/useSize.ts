import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultWindow } from '../internal/env';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';

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

/**
 * Track element size/position reactively.
 *
 * @fictReturn { width: 'signal', height: 'signal', top: 'signal', left: 'signal', x: 'signal', y: 'signal', isSupported: 'signal', active: 'signal' }
 */
export function useSize(target: MaybeElement | null, options: UseSizeOptions = {}): UseSizeReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const observerCtor =
    (windowRef as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver ??
    globalThis.ResizeObserver;

  const width = createSignal(options.initialWidth ?? 0);
  const height = createSignal(options.initialHeight ?? 0);
  const top = createSignal(options.initialTop ?? 0);
  const left = createSignal(options.initialLeft ?? 0);
  const x = createSignal(options.initialX ?? options.initialLeft ?? 0);
  const y = createSignal(options.initialY ?? options.initialTop ?? 0);
  const isSupported = createSignal(!!observerCtor);
  const active = createSignal(options.immediate ?? true);

  let observer: ResizeObserver | null = null;

  const applyRect = (nextTarget: Element) => {
    const rect = readRect(nextTarget);
    width(rect.width);
    height(rect.height);
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

  createEffect(() => {
    stopObserver();

    const nextTarget = target ? resolveMaybeTarget(target) : undefined;
    if (!active() || !nextTarget) {
      resizeListener.stop();
      return;
    }

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
      if (entry?.contentRect) {
        width(entry.contentRect.width);
        height(entry.contentRect.height);
        applyRect(nextTarget);
        return;
      }
      applyRect(nextTarget);
    });

    observer.observe(nextTarget, options.box ? { box: options.box } : undefined);

    onCleanup(() => {
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
      resizeListener.stop();
      stopObserver();
    }
  };
}
