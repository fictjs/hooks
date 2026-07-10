import { createEffect } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultDocument } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
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
  const titleSignal = createSignal(documentRef?.title ?? toValue(value as MaybeAccessor<string>));
  let disposed = false;

  const setTitle = (nextTitle: string) => {
    if (disposed) {
      return;
    }
    titleSignal(nextTitle);
    if (disposed) {
      return;
    }
    if (documentRef) {
      documentRef.title = nextTitle;
    }
  };

  const title = function title(nextTitle?: string) {
    if (arguments.length === 0) {
      return titleSignal();
    }
    setTitle(nextTitle ?? '');
  } as typeof titleSignal;

  createEffect(() => {
    const nextTitle = toValue(value as MaybeAccessor<string>);
    setTitle(nextTitle);
  });

  tryOnDestroy(() => {
    disposed = true;
    if (options.restoreOnUnmount && documentRef) {
      documentRef.title = initialTitle;
    }
  });

  return { title };
}
