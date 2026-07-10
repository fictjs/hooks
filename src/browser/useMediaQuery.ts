import { createEffect, onCleanup } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultWindow } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';
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
  listener: (event: MediaQueryListEvent) => void,
  canRegister: () => boolean
): () => void {
  let registered = false;
  let remove = () => {};
  const stop = () => {
    if (!registered) {
      return;
    }
    registered = false;
    remove();
  };

  const addEventListener = mql.addEventListener;
  if (!canRegister()) {
    return stop;
  }
  if (typeof addEventListener === 'function') {
    const removeEventListener = mql.removeEventListener;
    if (!canRegister()) {
      return stop;
    }
    const eventListener = listener as EventListener;
    remove = () => {
      removeEventListener.call(mql, 'change', eventListener);
    };
    registered = true;
    try {
      addEventListener.call(mql, 'change', eventListener);
    } catch (error) {
      try {
        stop();
      } catch {
        // Preserve the registration failure after best-effort rollback.
      }
      throw error;
    }
  } else {
    const legacyMql = mql as unknown as LegacyMediaQueryList;
    const addListener = legacyMql.addListener;
    if (!canRegister() || typeof addListener !== 'function') {
      return stop;
    }
    const removeListener = legacyMql.removeListener;
    if (!canRegister()) {
      return stop;
    }
    remove = () => {
      removeListener?.call(legacyMql, listener);
    };
    registered = true;
    try {
      addListener.call(legacyMql, listener);
    } catch (error) {
      try {
        stop();
      } catch {
        // Preserve the registration failure after best-effort rollback.
      }
      throw error;
    }
  }

  if (!canRegister()) {
    try {
      stop();
    } catch {
      // A terminal registration has no owner to report cleanup failures to.
    }
  }
  return stop;
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
  let effectGeneration = 0;
  let disposed = false;

  tryOnDestroy(() => {
    disposed = true;
    effectGeneration += 1;
  });

  createEffect(() => {
    if (disposed) {
      return;
    }
    const currentGeneration = ++effectGeneration;
    const canCommit = () => !disposed && currentGeneration === effectGeneration;
    let removeListener = () => {};
    onCleanup(() => {
      if (currentGeneration === effectGeneration) {
        effectGeneration += 1;
      }
      removeListener();
    });

    const nextQuery = toValue(mediaQuery as MaybeAccessor<string>);
    if (!canCommit()) {
      return;
    }
    query(nextQuery);
    if (!canCommit()) {
      return;
    }

    const matchMedia = windowRef?.matchMedia;
    if (!canCommit()) {
      return;
    }
    if (typeof matchMedia !== 'function') {
      isSupported(false);
      if (!canCommit()) {
        return;
      }
      matches(fallback);
      return;
    }

    isSupported(true);
    if (!canCommit()) {
      return;
    }
    const mql = matchMedia.call(windowRef, nextQuery);
    if (!canCommit()) {
      return;
    }
    const initialMatches = mql.matches;
    if (!canCommit()) {
      return;
    }
    matches(initialMatches);
    if (!canCommit()) {
      return;
    }

    let callbackGeneration = 0;
    const listener = (event: MediaQueryListEvent) => {
      if (!canCommit()) {
        return;
      }
      const currentCallback = ++callbackGeneration;
      const nextMatches = event.matches;
      if (!canCommit() || currentCallback !== callbackGeneration) {
        return;
      }
      matches(nextMatches);
    };

    const stopListener = addMediaQueryListener(mql, listener, canCommit);
    if (!canCommit()) {
      try {
        stopListener();
      } catch {
        // A terminal setup has no owner to report cleanup failures to.
      }
      return;
    }
    removeListener = stopListener;
  });

  return {
    matches,
    query,
    isSupported
  };
}
