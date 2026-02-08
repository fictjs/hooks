import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultDocument, defaultNavigator, defaultWindow } from '../internal/env';

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
  const textarea = documentRef.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  documentRef.body.appendChild(textarea);
  textarea.select();

  try {
    return documentRef.execCommand('copy');
  } catch {
    return false;
  } finally {
    documentRef.body.removeChild(textarea);
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

  const resetCopiedLater = () => {
    if (!windowRef) {
      copied(false);
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = windowRef.setTimeout(() => {
      copied(false);
      timer = undefined;
    }, copiedDuring);
  };

  const copy = async (value: string): Promise<boolean> => {
    text(value);

    if (navigatorRef?.clipboard?.writeText) {
      try {
        await navigatorRef.clipboard.writeText(value);
        copied(true);
        resetCopiedLater();
        return true;
      } catch {
        copied(false);
        return false;
      }
    }

    if (documentRef) {
      const ok = fallbackCopy(value, documentRef);
      copied(ok);
      if (ok) {
        resetCopiedLater();
      }
      return ok;
    }

    copied(false);
    return false;
  };

  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
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
