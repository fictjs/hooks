import { createEffect, onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultDocument } from '../internal/env';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface UseTitleOptions {
  document?: Document | null;
  restoreOnUnmount?: boolean;
}

export interface UseTitleReturn {
  title: () => string;
}

/**
 * Reactive document title helper.
 *
 * @fictReturn { title: 'signal' }
 */
export function useTitle(
  value: string | MaybeAccessor<string>,
  options: UseTitleOptions = {}
): UseTitleReturn {
  const documentRef = options.document === undefined ? defaultDocument : options.document;
  const initialTitle = documentRef?.title ?? '';
  const title = createSignal(documentRef?.title ?? toValue(value as MaybeAccessor<string>));

  createEffect(() => {
    const nextTitle = toValue(value as MaybeAccessor<string>);
    title(nextTitle);
    if (documentRef) {
      documentRef.title = nextTitle;
    }
  });

  if (options.restoreOnUnmount) {
    onDestroy(() => {
      if (documentRef) {
        documentRef.title = initialTitle;
      }
    });
  }

  return { title };
}
