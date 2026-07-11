import { createSignal } from '@fictjs/runtime/advanced';
import { defaultDocument, defaultNavigator, defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

type NavigatorClipboardLike = {
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
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

function fallbackCopy(value: string, documentRef: Document): boolean {
  let textarea: HTMLTextAreaElement | undefined;

  try {
    const body = documentRef.body;
    if (!body) {
      return false;
    }

    textarea = documentRef.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    body.appendChild(textarea);
    textarea.select();
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

  const resetCopiedLater = () => {
    if (!windowRef) {
      copied(false);
      return;
    }
    if (timer !== undefined) {
      windowRef.clearTimeout(timer);
    }
    timer = windowRef.setTimeout(() => {
      copied(false);
      timer = undefined;
    }, copiedDuring);
  };

  const copy = async (value: string): Promise<boolean> => {
    if (disposed) {
      return false;
    }

    const currentGeneration = ++generation;
    const canCommit = () => !disposed && currentGeneration === generation;
    text(value);

    if (navigatorRef?.clipboard?.writeText) {
      try {
        await navigatorRef.clipboard.writeText(value);
        if (canCommit()) {
          copied(true);
          resetCopiedLater();
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
      const ok = fallbackCopy(value, documentRef);
      if (canCommit()) {
        copied(ok);
        if (ok) {
          resetCopiedLater();
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
