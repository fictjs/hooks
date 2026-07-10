import { createSignal } from '@fictjs/runtime/advanced';
import { defaultDocument, defaultNavigator, defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

type NavigatorClipboardLike = {
  clipboard?: ClipboardLike;
};

type ClipboardLike = {
  writeText: (text: string) => Promise<void>;
};

export interface UseClipboardOptions {
  navigator?: NavigatorClipboardLike | null;
  document?: Document | null;
  window?: Window | null;
  copiedDuring?: number;
}

export interface UseClipboardReturn {
  text: () => string;
  copied: () => boolean;
  isSupported: () => boolean;
  copy: (value: string) => Promise<boolean>;
}

function fallbackCopy(value: string, documentRef: Document, canContinue: () => boolean): boolean {
  let textarea: HTMLTextAreaElement | undefined;

  try {
    if (!canContinue()) {
      return false;
    }
    const body = documentRef.body;
    if (!canContinue() || !body) {
      return false;
    }

    textarea = documentRef.createElement('textarea');
    if (!canContinue()) {
      return false;
    }
    textarea.value = value;
    if (!canContinue()) {
      return false;
    }
    textarea.setAttribute('readonly', 'true');
    if (!canContinue()) {
      return false;
    }
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    if (!canContinue()) {
      return false;
    }
    body.appendChild(textarea);
    if (!canContinue()) {
      return false;
    }
    textarea.select();
    if (!canContinue()) {
      return false;
    }
    return documentRef.execCommand('copy');
  } catch {
    return false;
  } finally {
    try {
      textarea?.remove();
    } catch {
      // Cleanup failures must not change the boolean copy result.
    }
    try {
      if (textarea?.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    } catch {
      // Older or custom DOM implementations may reject both cleanup paths.
    }
  }
}

/**
 * Clipboard write helper with copied state.
 *
 * @fictReturn { text: 'signal', copied: 'signal', isSupported: 'signal' }
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const navigatorRef =
    options.navigator === undefined
      ? (defaultNavigator as NavigatorClipboardLike | undefined)
      : options.navigator;
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const windowRef = options.window === undefined ? defaultWindow : options.window;

  const text = createSignal('');
  const copied = createSignal(false);
  const isSupported = createSignal(
    !!navigatorRef?.clipboard?.writeText || !!documentRef?.execCommand
  );

  const copiedDuring = options.copiedDuring ?? 1500;
  let timer: number | undefined;
  let generation = 0;
  let disposed = false;

  const resetCopiedLater = (canCommit: () => boolean) => {
    if (!canCommit()) {
      return;
    }
    if (!windowRef) {
      copied(false);
      return;
    }
    if (timer !== undefined) {
      const currentTimer = timer;
      timer = undefined;
      windowRef.clearTimeout(currentTimer);
      if (!canCommit()) {
        return;
      }
    }
    let firedSynchronously = false;
    let scheduling = true;
    let nextTimer: number | undefined;
    try {
      nextTimer = windowRef.setTimeout(() => {
        firedSynchronously = true;
        if (!canCommit()) {
          return;
        }
        if (!scheduling && timer !== nextTimer) {
          return;
        }
        if (!scheduling) {
          timer = undefined;
        }
        copied(false);
      }, copiedDuring);
    } catch {
      if (canCommit()) {
        copied(false);
      }
      return;
    } finally {
      scheduling = false;
    }
    if (firedSynchronously) {
      return;
    }
    if (nextTimer === undefined) {
      return;
    }
    if (!canCommit()) {
      windowRef.clearTimeout(nextTimer);
      return;
    }
    timer = nextTimer;
  };

  const copy = async (value: string): Promise<boolean> => {
    if (disposed) {
      return false;
    }

    const currentGeneration = ++generation;
    const canCommit = () => !disposed && currentGeneration === generation;
    text(value);
    if (!canCommit()) {
      return false;
    }

    let clipboard: ClipboardLike | undefined;
    let writeText: ClipboardLike['writeText'] | undefined;
    try {
      clipboard = navigatorRef?.clipboard;
      if (!canCommit()) {
        return false;
      }
      writeText = clipboard?.writeText;
    } catch {
      if (canCommit()) {
        copied(false);
      }
      return false;
    }
    if (!canCommit()) {
      return false;
    }

    if (writeText) {
      try {
        await writeText.call(clipboard, value);
        if (canCommit()) {
          copied(true);
          if (canCommit()) {
            resetCopiedLater(canCommit);
          }
        }
        return true;
      } catch {
        if (canCommit()) {
          copied(false);
        }
        return false;
      }
    }

    if (documentRef) {
      const ok = fallbackCopy(value, documentRef, canCommit);
      if (canCommit()) {
        copied(ok);
        if (ok && canCommit()) {
          resetCopiedLater(canCommit);
        }
      }
      return ok;
    }

    if (canCommit()) {
      copied(false);
    }
    return false;
  };

  tryOnDestroy(() => {
    disposed = true;
    generation += 1;
    if (timer !== undefined && windowRef) {
      windowRef.clearTimeout(timer);
      timer = undefined;
    }
  });

  return {
    text,
    copied,
    isSupported,
    copy
  };
}
