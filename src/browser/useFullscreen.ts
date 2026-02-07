import { createEffect, onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultDocument } from '../internal/env';
import { resolveMaybeTarget, type MaybeElement } from '../internal/target';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends Element {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

export interface UseFullscreenOptions {
  target?: MaybeElement | null;
  document?: Document | null;
  autoExit?: boolean;
}

export interface UseFullscreenReturn {
  isSupported: () => boolean;
  isFullscreen: () => boolean;
  enter: () => Promise<boolean>;
  exit: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
}

function getFullscreenElement(documentRef: FullscreenDocument): Element | null {
  return (
    documentRef.fullscreenElement ??
    documentRef.webkitFullscreenElement ??
    documentRef.mozFullScreenElement ??
    documentRef.msFullscreenElement ??
    null
  );
}

function isFullscreenSupported(documentRef: FullscreenDocument | null | undefined): boolean {
  if (!documentRef) {
    return false;
  }

  if (
    documentRef.fullscreenEnabled ||
    documentRef.webkitFullscreenEnabled ||
    documentRef.mozFullScreenEnabled ||
    documentRef.msFullscreenEnabled
  ) {
    return true;
  }

  return (
    typeof documentRef.exitFullscreen === 'function' ||
    typeof documentRef.webkitExitFullscreen === 'function' ||
    typeof documentRef.mozCancelFullScreen === 'function' ||
    typeof documentRef.msExitFullscreen === 'function'
  );
}

function resolveRequestMethod(target: FullscreenElement): (() => Promise<void> | void) | undefined {
  return (
    target.requestFullscreen ??
    target.webkitRequestFullscreen ??
    target.webkitRequestFullScreen ??
    target.mozRequestFullScreen ??
    target.msRequestFullscreen
  );
}

function resolveExitMethod(
  documentRef: FullscreenDocument
): (() => Promise<void> | void) | undefined {
  return (
    documentRef.exitFullscreen ??
    documentRef.webkitExitFullscreen ??
    documentRef.mozCancelFullScreen ??
    documentRef.msExitFullscreen
  );
}

function resolveTargetElement(
  options: UseFullscreenOptions,
  documentRef: FullscreenDocument | null
): Element | undefined {
  if (!documentRef) {
    return undefined;
  }
  if (options.target === null) {
    return undefined;
  }
  if (options.target === undefined) {
    return documentRef.documentElement ?? undefined;
  }
  return resolveMaybeTarget(options.target);
}

/**
 * Fullscreen API wrapper for target elements.
 *
 * @fictReturn { isSupported: 'signal', isFullscreen: 'signal' }
 */
export function useFullscreen(options: UseFullscreenOptions = {}): UseFullscreenReturn {
  const documentRef = (
    options.document === undefined ? defaultDocument : options.document
  ) as FullscreenDocument | null;

  const isSupported = createSignal(isFullscreenSupported(documentRef));
  const isFullscreen = createSignal(false);

  const update = () => {
    if (!documentRef) {
      isFullscreen(false);
      isSupported(false);
      return;
    }

    isSupported(isFullscreenSupported(documentRef));
    const target = resolveTargetElement(options, documentRef);
    const fullscreenElement = getFullscreenElement(documentRef);
    isFullscreen(!!target && !!fullscreenElement && fullscreenElement === target);
  };

  useEventListener(
    documentRef,
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'],
    update,
    { passive: true }
  );

  createEffect(() => {
    resolveTargetElement(options, documentRef);
    update();
  });

  const enter = async (): Promise<boolean> => {
    if (!documentRef || !isSupported()) {
      return false;
    }

    const target = resolveTargetElement(options, documentRef) as FullscreenElement | undefined;
    if (!target) {
      return false;
    }

    const request = resolveRequestMethod(target);
    if (!request) {
      return false;
    }

    try {
      await request.call(target);
      update();
      return true;
    } catch {
      update();
      return false;
    }
  };

  const exit = async (): Promise<boolean> => {
    if (!documentRef || !isSupported()) {
      return false;
    }

    const exitMethod = resolveExitMethod(documentRef);
    if (!exitMethod) {
      return false;
    }

    try {
      await exitMethod.call(documentRef);
      update();
      return true;
    } catch {
      update();
      return false;
    }
  };

  const toggle = async (): Promise<boolean> => {
    return isFullscreen() ? exit() : enter();
  };

  if (options.autoExit) {
    onDestroy(() => {
      void exit();
    });
  }

  return {
    isSupported,
    isFullscreen,
    enter,
    exit,
    toggle
  };
}
