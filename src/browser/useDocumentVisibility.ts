import { createMemo } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { useEventListener } from '../event/useEventListener';
import { defaultDocument } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

export interface UseDocumentVisibilityOptions {
  document?: Document | null;
  initialVisibility?: DocumentVisibilityState;
}

export interface UseDocumentVisibilityReturn {
  visibility: () => DocumentVisibilityState;
  hidden: () => boolean;
}

/**
 * Track page visibility state.
 *
 * @fictReturn { visibility: 'signal', hidden: 'memo' }
 */
export function useDocumentVisibility(
  options: UseDocumentVisibilityOptions = {}
): UseDocumentVisibilityReturn {
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const fallback = options.initialVisibility ?? 'visible';

  const visibility = createSignal(documentRef?.visibilityState ?? fallback);
  let disposed = false;

  function update(): void {
    if (disposed) {
      return;
    }
    const nextVisibility = documentRef?.visibilityState ?? fallback;
    if (disposed) {
      return;
    }
    visibility(nextVisibility);
  }

  useEventListener(documentRef, 'visibilitychange', update, { passive: true });
  tryOnDestroy(() => {
    disposed = true;
  });

  const hidden = createMemo(() => visibility() !== 'visible');

  return {
    visibility,
    hidden
  };
}
