import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface UseMediaQueryOptions {
  window?: Window | null;
  initialValue?: boolean;
}

export interface UseMediaQueryReturn {
  matches: () => boolean;
  query: () => string;
  isSupported: () => boolean;
}

interface LegacyMediaQueryList {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
}

function addMediaQueryListener(
  mql: MediaQueryList,
  listener: (event: MediaQueryListEvent) => void
): () => void {
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', listener);
    return () => {
      mql.removeEventListener('change', listener);
    };
  }

  (mql as unknown as LegacyMediaQueryList).addListener?.(listener);
  return () => {
    (mql as unknown as LegacyMediaQueryList).removeListener?.(listener);
  };
}

/**
 * Reactive media query matching state.
 *
 * @fictReturn { matches: 'signal', query: 'signal', isSupported: 'signal' }
 */
export function useMediaQuery(
  mediaQuery: string | MaybeAccessor<string>,
  options: UseMediaQueryOptions = {}
): UseMediaQueryReturn {
  const windowRef = options.window === undefined ? defaultWindow : options.window;
  const fallback = options.initialValue ?? false;

  const matches = createSignal(fallback);
  const query = createSignal(typeof mediaQuery === 'string' ? mediaQuery : '');
  const isSupported = createSignal(!!windowRef?.matchMedia);

  createEffect(() => {
    const nextQuery = toValue(mediaQuery as MaybeAccessor<string>);
    query(nextQuery);

    if (!windowRef?.matchMedia) {
      isSupported(false);
      matches(fallback);
      return;
    }

    isSupported(true);
    const mql = windowRef.matchMedia(nextQuery);
    matches(mql.matches);

    const listener = (event: MediaQueryListEvent) => {
      matches(event.matches);
    };

    const removeListener = addMediaQueryListener(mql, listener);
    onCleanup(() => {
      removeListener();
    });
  });

  return {
    matches,
    query,
    isSupported
  };
}
